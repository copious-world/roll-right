# roll-right background

The tool is the result of having no desire to spend all day making web pages and other interfaces.

This project started out as something to help save time.  Sometimes it did, sometimes work on the output progressed faster. It started out as something to keep small and generated some output web pages. Then, I edited its end results by hand. But, there is a need to propagate improvements made directly to the outputs of this tool. So, there is a need to take snippets from edge-of-the-envelope textual artifacts back into the pool of snippets the tool reads, and then use this tool again to change/upgrade all textual artifacts using the snippet repository. As a result, I revisited this project and started making something that is more like a web page compiler. Also, I have a framework for PWAs (progressive web apps) that this tool can be applied to. (The aim of this side trip is to shutdown a certain amount of interface creation labor.)

Making UI components is not a bad thing to do, in fact, it's quite good. But, why should it take longer than expected? Indeed, there are minutia, weird practices by different interface communities, gotchas, and more. Something as simple in concept as CSS has turned into a strange black art sort of quagmire yielding heaps of frustration. There are so many times that CSS magic fails to get to the goal and some JavaScript has to be added. 

Once a final interface goal has been reached, it's change may have been worked out for one final output page. But, a website manager may have a number of pages required as outputs. It follows that there is a huge chore (which can always be put off) to put successful changes into all the output pages an organization might manage. A small website company could end up spending countless hours taking keeping code up to date with local bug fixes. So, some better process is needed.

Here, the idea is that there should be a repository of snippets and skeletons of output pages. A process requiring configuration files reflecting choices made by the user of the program, can take use the skeletons to generate outputs. Changes can be put into a common code base, skeletons can be brought up to date, choice interface markup can be stored in a repository. Then, one tool can roll the changes forward into final outputs. If users have content already made for the sites, the tool could move quickly through all phases (one run) and output updates. But, a user could also start up a new concern and add content to sections described to the user by intermediate outputs of the tool, so the user could make changes between running phases of the tool.

**roll-right** works in phases. Each phase generates outputs and configurations for use in the next phase, until the final outputs are placed into a "staging" directory. In the end, the staging directory should be something that can be copied to a server directory where a web server looks for web pages and code pages.

#### Composition (skeletons to templates)

This tool mainly puts together snippets into final forms, files, directories. It does not attempt to know much, but is useful where replication with small differences works. That is, it is not going to be better than just copying files if that is all that has to be done. Also, it is not an automatic programming agent (at least no yet).

***This tool is good at making templates that then get customization, personalization, etc. via a substitution process.***

### not a component library

I don't think of skeleton files as components. These are pre-temlates. The tool reads them in order to produces HTML templates. The HTML templates can have values inserted into them by tools such as [mustache](https://mustache.github.io/).

The skeletons provide definitions of structure, program inclusion, etc. The skeletons keep a record of the shape of the page, the kinds of programs it run, and helps manage what should be included in the text of the page versus what should be loaded through deferred links. The output can be expected to be static in the sense that HTML (or other) does not refer to a server to rewrite its view structurally. Some of the pages I have generated include Svelte components that update when retrieving data from the server. But, the page does not become another interface, in the sense that a grid of movie choices does not turn into an editor. **roll-right** does not provide a server that generates HTML for given URL APIs. It just reads the skeletons and turns them into the pages needed by a concern. Some of those pages might include component based apps.

* Components, such as the kind made with Svelte, allow for the extension of markup by adding tags with parameters. The component is expected to come with code, HTML, and CSS. The HTML within a component may use tags that are imported into the component program. In some sense, each component is a subroutine, a part of a maintained code base.

* Skeletons import/generate everything that they are told to import/generate and what they import/generate becomes part of the text of the program. Skeletons refer to big chunks of code to use, numerous chunks of code, and very commonly used markup structure. All of these inclusions are part of a common code base, that a web manager maintains. The skeleton files should be fairly short, say thirty to a hundred lines, and be used to generate a few thousand lines along with bundles for components used across skeletons.

Skeletons are used to generate different versions of outputs that are configured into working single page files, with some possible external links to maintained bundles. Likely, the different versions, which are different structurally, should have been proven to work so that the output generation is a selection of a view structure or program application type, rather than something to debug. 

> In spite of the aim of this project, other kinds of text files can be output through the process, including programs, documents, art.

If the skeleton is used to generate a component, such as the kind made using Svelte, it will first create a template in preparation for variable substitution, then it will output the artifacts for the component in a pre-staging directory (a build directory). In other words, it carries out the same process of a static HTML file to build whatever. (Depending on the glossary of directives available in a roll-right release, this may be any kind of program.) After that, the build tools for the components will have to be applied in order to finalize the component for release. 
