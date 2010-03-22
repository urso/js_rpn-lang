
Introduction
============

rpn-lang (Reverse Polish Notation Language) is a simple interpreter for an
even more simple stack command language with a configurable environment which
sets the operations/commands allowed to be executed by the interpreter.

Requirements
============

## Runtime

In order to use the "rpn_lang.js" file you will need to load
the following list of libraries first:

- [js mylib](http://github.com/urso/js_mystdlib):  
  just some additional functions being used by rpn_lang.js.
  You will need the file "fun.js" only.

- [jsparse](http://github.com/doublec/jsparse):
  PEG Parser used by rpn_lang.js. You will need the file "jsparse.js" only.

## Building API/Documentation

In order to build the documentation you will need:

- [jsdoc toolkit](http://code.google.com/p/jsdoc-toolkit/).
  It is also recommended to set the JSDOCDIR environment variable

- [jsdoc simple template](http://github.com/urso/jsdoc-simple):  
  just copy 'jsdoc-simple' directory to jsdoc toolkit's template directory

- [pandoc](http://johnmacfarlane.net/pandoc/installing.html):  
  used to preprocess static documentation files. Alternatively you can use any
  other markdown preprocessor and update jsdoc.conf in the source directory 
  to use that preprocessor instead of pandoc.

- run './mkdoc' shell command (needs *nix shell).

Usage
=====

rpn-lang only exports the functions **rpn_compress** and **rpn_eval**:

- rpn_compress(string): just removes almost all unneeded whitespace characters
- rpn_eval(...): evaluates an rpn-lang expression.

Additionally a very minimal Environment is provided by the global variable
rpnPrelude. This minimal Environment defines the following operators:

- **,** and **;** :  
  comma and semicolon separator.

- **+**, **-**, **\***, **/**:  
  very basic arithmetic operations.

- alert, id, true, false, null: ...

Due to the definition if **,**, **;**, true, false and null rpn-lang can 
even parse JSON (in fact JSON is a subset of rpn-lang with the rpnPrelude
environment).

## Datatypes

rpn-lang itself without a given environment has only support for numbers,
strings, arrays and objects.

### Numbers
Just any valid integer or floating point number. For example

    1
    1.4
    3.14159265
    .45
    -1

### Strings

Like in JavaScript all Strings must be enclosed into single quotes \' or
double quotes \".

### Arrays

Just some values separated by whitespace/tabs/newlines will be interpreted as
arrays. Alternatively (for example when nesting arrays) on can surround them
by brackets or parenthesis.

If array elements need to be separated by commas, one must use an environment
with the **,** operator defined as 

    function(x){ return x; }

### Objects

Objects are always surrounded by braces ( "**{**" and "**}**" ) and fields are
separated from values by the **:** character. A Field's name can be a string
or a symbol just like in JavaScript, but unlike JavaScript they are not
separated by commas.  
For example these are all valid objects:

    { foo: 1 2 3
      bar: "test" }

    { foo: "abc"
      "bar" : "bar value" }

## Environments

An environment is just an optional object used while parsing.  Each field in
the object will be available as command to the interpreter.  If a field
contains a value other than a function, it's value will be pushed onto the
stack. If on the other hand it's a function, the function will be execute and
the functions return value (is any) will be pushed onto the stack.  The
functions arity n is determined before execution, so the last n values pushed
to the execution stack will be poped and given to the environment function.  
For example see rpnPrelude:

    rpnPrelude = {
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

