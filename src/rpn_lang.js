
(function(){
    function act(p, f){
        var p = toParser(p);
        return function(input){
            var x = p(input);
            if(x){ x.ast = f(x); }
            return x;
        }
    }

    function pOneOf(pattern){
        return function(input){
            for(var i=0; i < pattern.length; i++){
                var x = token(pattern.charAt(i))(input);
                if(x) return x;
            }
            return false;
        }
    }

    var lpInt = act(repeat1(range('0','9')),
                    function(x){ return parseInt(x.matched); });

    var lpFloat = act(sequence(repeat0(range('0','9')), ".", repeat1(range('0','9'))),
                      function(x){ return parseFloat(x.matched); });

    var eof = act(end_p, function(){ return {type: eof}; });
    var error = act(epsilon_p, function(){ return {type: error}; }); //just in case something funny happens...
    var openList = act(choice("[", "("), function(){ return {type: openList}; });
    var closeList = act(choice("]", ")"), function(){ return {type: closeList}; });

    var numberObj = action(choice(lpFloat, lpInt),
                           function(x){ return {type: numberObj, value: x}; });

    var name =   5;
    var startObj =  act("{", function(){ return {type: startObj}; });
    var endObj =    act("}", function(){ return {type: endObj}; });
    var slotName =   8;
    var beforeSlotName = act(":", function(){ return {type: beforeSlotName}; });

    var stringObj = act(choice(sequence(expect("\'"), repeat0(negate("'")), expect("'")),
                             sequence(expect('"'), 
                                      repeat0(choice(negate(choice("\\\"", "\"")),
                                                        "\\\"")),
                                      expect('"'))),
                   function(x){ return {type: stringObj, value: x.matched}; });

    var lpSpaces = repeat1(pOneOf(" \t\n\r"));

    var special = pOneOf("[](){}\"\':");
    var specialOrSpace = choice(special, lpSpaces);
    var symbol = act(sequence(
                        negate(choice(special, range('0','9'))),
                        act(repeat0(negate(specialOrSpace)), function(x){ return x.matched; }),
                        choice( act(expect(":"), function(x){ return {type: slotName};}),
                                   act(epsilon_p, function(x){ return {type: name};}))),
                     function(x){ 
                         return { type: x.ast[2].type, value: x.ast[0] + x.ast[1] };
                     });

    var olComment = act(sequence(expect("\/\/"), repeat0(negate(choice(end_p, "\n")))),
                          function(x){ return {type: olComment, value: x.matching}; });

    var mlComment = act(sequence(expect("\/\*"), repeat0(negate("*/")), expect("*/")),
                          function(x){ return {type: mlComment, value: x.matching}; });
                  
    var tokenParser = choice(eof, openList, closeList, startObj, endObj, olComment, mlComment,
                           stringObj, beforeSlotName, numberObj, symbol, error);

    function Lexer(text) {
        var str = ps(text);
        return function(){
            var x = tokenParser(optional(lpSpaces)(str).remaining);
            if(!x) return {type: error, msg: "unknow token in: " + str};
            str = x.remaining;
            return x.ast;
        }
    }

    /** @scope _global_ */
    /**
     *
     * evaluates an rpn-lang expression.
     *
     * @param {Object} [env] environment with predefined commands.
     * @param {String} text  rpn-lang expression to evaluate
     * @param {Object} [opts] additional evaluations possible options:
     *                 <ul>
     *                 <li>
     *                 useTimer: boolean, if true setTimeout is used on
     *                           consecutive steps.
     *                 </li>
     *                 <li>
     *                 onError: function being called on error with error message
     *                 </li>
     *                 <li>
     *                 onLoad: function to be called when evaluation ended
     *                         successfully. onLoad is used if useTimer==true
     *                         only.
     *                 </li>
     *                 </ul>
     *
     * @function
     */
    this.rpn_eval = function(env, text, opts) {
        var text = text || env;
        var env  = arguments.length > 1 ? env : {};
        var opts = opts || {};
        var timerID;

        // program state
        var lexer = Lexer(text);
        var stacks_stack = [];
        var stacks_state = [];
        var stack = [];
        var objs_stack = [];
        var objName_stack = [];
        var obj = undefined;
        var objName = undefined;

        if(opts.useTimer){
            timerID = setTimeout(doEval,0);
            return {stop: function(){ clearTimeout(timerID); }};
        } else {
            return doEval();
        }

        function err(msg){
            if(opts.onError) opts.onError(msg);
            else throw msg;
        }

        function doEval(){

            var val;
            while($defined(val = lexer())) {
                switch(val.type){
                    case eof:
                        if( stacks_stack.length > 0 ) {
                            err({ msg: "missing list closing bracket at end of script" });
                        }
                        val = stack.length > 1 ? stack : stack[0];
                        if(opts.useTimer){
                            if(opts.onLoad) opts.onLoad(val);
                            return;
                        } else {
                            return val;
                        }
                    case error:
                        err(val.msg);
                    case openList:
                        stacks_stack.push(stack);
                        stacks_state.push(openList);
                        stack = [];
                        break;
                    case closeList:
                        if(stacks_stack.length == 0) {
                            val.msg = "missing list opening bracket";
                            err(val);
                        }
                        if(openList !== stacks_state.pop()) {
                            val.msg = "missing correspondent list opening bracket";
                            err(val);
                        }
                        var tmp = stack;
                        stack = stacks_stack.pop();
                        stack.push(tmp);
                        break;
                    case stringObj:
                    case numberObj:
                        stack.push(val.value);
                        break;
                    case name:
                        var what = env[val.value];
                        if(!$defined(what)) {
                            val.msg =  "unkown identifier: " + val.value;
                            err(val);
                        }

                        if(typeof what === 'function') {
                            var n = what.length;
                            var args = stack.splice(stack.length-n, n);
                            var result = what.apply(env, args);
                            if($defined(result)) stack.push(result);
                        } else {
                            stack.push(what);
                        }
                        break;
                    case startObj:
                        stacks_stack.push(stack);
                        stacks_state.push(startObj);
                        stack = [];
                        if($defined(obj)) objs_stack.push(obj);
                        if($defined(objName)) objName_stack.push(objName);
                        obj = {};
                        objName = undefined;
                        break;
                    case endObj:
                        if(startObj != stacks_state.pop()) {
                            val.msg = "missing {";
                            err(val);
                        }
                        if(!$defined(objName) && stack.length > 0) {
                            val.msg = "found object values without assignment";
                            err(val);
                        }
                        if($defined(objName)){
                            obj[objName] = stack.length > 1 ? stack : stack[0];
                        }

                        stack = stacks_stack.pop();
                        stack.push(obj);
                        obj = objs_stack.pop();
                        objName = objName_stack.pop();
                        break;
                    case slotName:
                        if(!$defined(obj)) {
                            val.msg = "no object defined";
                            err(val);
                        }
                        if($defined(objName)){
                            obj[objName] = stack.length > 1 ? stack : stack[0];
                            stack = [];
                        }
                        if(stack.length > 0) {
                            val.msg = "found object values without assignment";
                            err(val);
                        }
                        objName = val.value;
                        break;
                    case beforeSlotName:
                        if(!$defined(obj)) {
                            val.msg = "no object defined";
                            err(val);
                        }
                        var newName= stack.pop();

                        if($defined(objName)){
                            obj[objName] = stack.length > 1 ? stack : stack[0];
                            stack = [];
                        }
                        if(stack.length > 0) {
                            val.msg = "found object values without assignment";
                            err(val);
                        }
                        if(!newName && typeof newName !== 'string') {
                            val.msg = "object field without name";
                            err(val);
                        }
                        objName = newName;
                        break;
                    default:  //ignore comments
                        break;
                }
                if(opts.useTimer){
                    setTimeout(doEval, 0);
                    return;
                }
            }
        }
    }

    /** @scope _global_ */
    /**
     * compresses a rpn-lang script by removing almost all unnecessary spaces
     * and newlines.
     */
    this.rpn_compress = function(text) {
        var lexer = Lexer(text);
        var buf = "";
        var val = lexer();
        while(val.type !== eof) {
            switch(val.type){
                case openList: buf += "["; 
                               val = lexer();
                               break;
                case closeList: buf += "]";
                                val = lexer();
                                break;
                case startObj: buf += "{";
                               val = lexer();
                               break;
                case endObj: buf += "}";
                             val = lexer();
                             break;
                case stringObj: buf += "\'" + val.value + "\'";
                                val = lexer();
                                break;
                case numberObj: buf += val.value;
                                val = lexer();
                                if(val.type === numberObj) buf+= " ";
                                break;
                case name: buf += val.value;
                           val = lexer();
                           switch(val.type){
                               case name:
                               case slotName:
                               case numberObj:
                               case beforeSlotName:
                                   buf += " ";
                           }
                           break;
                case slotName: buf += val.value + ":";
                               break;
                case beforeSlotName: buf += ":";
                                     break;
                default: val = lexer();
            }
        }
        return buf;
    }

    /** @scope _global_ */
    /**
     * minimalistic standard environment to be used with rpn_eval.
     */
    this.rpnPrelude = {
        ',': function(x){ return x; },
        ';': function(x){ return x; },
        '+': function(x, y){ return x + y; },
        '-': function(x, y){ return x - y; },
        '*': function(x, y){ return x * y; },
        '/': function(x, y){ return x / y; },
        'alert': function(x){ alert(x); return x;},
        'id': function(x){ return x; },
        'true': true,
        'false': false,
        'null': null
    }
})();

