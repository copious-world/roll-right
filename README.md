# roll-right

 A helper utilty for gather browser artifacts from node modules, code repositories, etc.


## How it Helps

This is tool is not a replacement for final publication steps enabled by rollup, browserify, or others.

This tool provides help with preparing and using an entry point into a module that can be used to obtain the browser version of a module. 

The aim is make it so that the tool does not have to look at a directory structure of a module, e.g. node_modules in order to get the browser version of some code. It does not require that the code be written in some strange way to accomodate the placement of the same code in two contexts. It does not require reading a special key in a package.json file peculiar to npm.

It does require that two versions of the node module/browser module/window level javascript, etc. be available in the package.

* It provides tools to help create the separate versions from one. 
* It provides tools to insert a snippet of code in the interface (entry point) level of the module.

The code inserted, is a call that will fetch the browser version of the code and return it to its caller. The caller will usually be the command line version of roll-right. Users will have access to the roll-right command line tool, and will call it to update to the latest browser version of code, depositing it where the rollup (or others) can get at it. 

For example, I have a Svelte project that needs some modules, but the modules might not be expressly published in npm. Instead, the modules can be deposited into a common directory accessible by the files in the projects. The build tool will grab those files from that diretory and put them in the final build file.

For another example, I have some code that must appear at the script level of index.html. It is not intended to be inside a module component. It will just be insterted at some point marked by a variable. The roll-right tool has to call a subtool that does the substitution and leaves the templated result in the appropriate project directory.


## Setting up publisher calls in a node.js module

First install the command line version of roll-right.




