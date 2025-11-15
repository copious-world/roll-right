# roll-right

A tool that helps generate HTML pages, or other types of pages.

There are two phases:

1. Phase 1 takes in a configuration file and a skeleton page to generate a template from a respository of file parts.
2. Phase 2 takes in a template and a configuration file that identifies how to populate template variables and insert content files into places in the template.

> In the end, the output can be a static web page (served directly from the web server without modification). The output might be something else, such as a computer program.

The process here is mostly subsitution with components having proven appearance and operation. Some of the files inserted might be code. And, this module takes into consideration the sensitivty  as to how much code should be in the page v.s. how much code should be fetched from a CDN.

## Differences Compared to Bundlers

* This main process used by this package is substition and expansion. The output is mainly a self contained file or a small collection of files. The output is not bundled. Also, there is a dependency on Handlebars, which handles conditional subsitution.

> After Phase 2, HTML output may be compressed and ready for upload. If compression is not requested, it may be handled by a bundler.

* Bundlers can be used to take some of the output from this program to create packages that finalize the packaging required for a website or web application.  Bundlers such as **rollup** or **vite** can be used for such operations if the final step is needed.

* Skeleton files: These files feed into phase 1. These files might be like a language. But, they are not. They provide an outline as to the order of files to be included. They are similar to a layout. These are used to feed into template creation. They use some limited features of programming languages.

* Templates: The templates output by phase 1 are ready for substitution. Substitution values are often targeted at making versions of websites for different concerns that may have the same templates.

> After phase 1, unsightly HTML files will be output with variables in place for substitution. These template files are passed into phase 2.



## Basic Use Process


***Here are steps of a generation process for site maintainers***:

1. store commonly used, well-tested code in files in selected directories
2. provide a file describing families of pages call *skeletons*
3. provide a JSON description that selects which skeleton parts are to be used along with source directories
4. run roll-right in phase 1 with the JSON to generate site templates
5. provide static components, pictures, etc. to populate templates
6. run roll-right in phase 2 with .subst files specifying the template population (instantiation)
7. use other tools to deploy files dropped into a staging directory

The generation process is not limited to coalescing code for pages. There is support for generating node.js modules, generating web page modules, etc. for npm publication.

## install it

```
npm install -g roll-right
```


## run it

```
roll-right --phase 1 <website-identifier> <directory including config>
```



```
roll-right --phase 2 <website-identifier> <directory including config>
```


## reverse it

It can help, when developing, to split up a file that has been composed by **roll-right**. Later versions of **roll-right** will put in file separators when files are appended together to form a single file artifact for a web page or module. The command line tool, **roll-right-breakup**, will output a directory of all the files between the separators. There are times that it may be useful to use compare tools with the output of **roll-right-breakup** and the source files.

Here is how to call it:

```
roll-right-breakup <path to file> <optional output directory>
```


**roll-right-breakup** will create a directory in the calling directory named **rr-breakup** or within the optional directory if it is on the command line.

## HTML Generation Steps

1. For generation of HTML, a project should begin first with a pre-template. The developer will either make one of these, or use one from a repository of them. A pre-template contains some HTML, usually the header; and, the header may **variable forms** in it. The ouline of the body may be available. But, somewhere in the pre-template will be **link forms** that indicate where files may be included. **May be included**... The pre-template usually lists more files than a project may want. But, the next step, 
2. The developer needs to make a cofiguration file. The configuration file is read by the **roll-right**, enabling **roll-right** to find the pre-tempalte and the set of files that will be use to replace **link forms**. The configuration file has its own set of variables. Every configuration file contains a JSON object with two fields **alpha** and **beta**. The **alpha** field contains the phase 1 configuration, while the **beta** field contains the phase 2 configuration. It is more likely that different projects will use the same alpha field and different beta fields.
3. 





## An example - human page

For humans of this world, we have created the of-this.world collection of subdomains. Each subdomain has a main access page, which is a dashboard owned by a particular user. The dashboard prominently displays a set of `<iframes>` that host other applications that make requests through it.

Each dashboard owner, a human, will have the page generated for him/her containing some name and identity information, the public part. Other processes make user that private information is stored in the user's browser under the user's URL. Each page is generated from a template used by the **of-this.world** server. And, the template is generated by an application of **roll-right**.

In order to generate the template, a pre-template is required. Here is the pre-template for the human page (some code is removed for the sake of brevity):

```
<!doctype html>
<html>
<head>
	<meta charset="utf-8">
	<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
	<meta name="author" content="{{who_am_I}}" />
	<meta name="viewport" content="width=device-width, minimum-scale=1.0, initial-scale=1.0, user-scalable=yes">
	<meta id="theme-color" name="theme-color" content="{{user-theme-color}}">

	<link rel="canonical" href="{{canonical}}">

	<title>{{who_am_I}}</title>
	<meta name="description" content="{{pageDescription}}">
	<style>
		/*csslint important:false*/
        .super-header {
            border: solid 1px rgb(223, 89, 11);
            padding: 2px;
            font-size: smaller;
            font-weight: 700;
            background-color: rgb(255, 254, 248);
            color: rgb(74, 83, 55);
            max-height:32px;
            width: 100%;
        }
        .content-container {
            border: solid 1px rgb(0, 6, 85);
            padding: 2px;
            padding-left: 1px;
            background-color: white;
            position: absolute;
            top: 34px;
            bottom: 0;
            width : calc(100vw - 4px);
        }
        
        ... etc ...
	</style>
</head>
<body>
<div id="super-header" class="super-header" style="white-space: nowrap;overflow-x: scroll;" >
    <span class="owner_name">{{who_am_I}}</span>
    <div id="open-controls" style="display:inline-block;">
        <button onclick="show_controls()">&gt;&gt;</button>
    </div>
    <div id="user-controls" style="display:none;">
        :: control page :: 
        <button id="db_container-btn" onclick="show_local_data()">local data</button>&nbsp;
        <button id="manager_container-btn" onclick="show_id_manager()">identity manager</button>&nbsp;
        <button id="wallet_container-btn" onclick="show_wallet_manager()">wallet manager</button>&nbsp;
        <button id="application_container-btn" onclick="show_application()" class="selected-frame">application</button>
        <button onclick="hide_controls()">&lt;&lt;</button>
    </div>
</div>

<div id="application_container" class="content-container" >
    <iframe id="content-frame" src="" class="super-container" >
    Source will open here
    </iframe>
</div>

<div id="manager_container" class="content-container" >
    <iframe id="id-manager-frame" src="https://www.of-this.world/manager" class="super-container" onload="info_to_manager_container()">
    manager frame
    </iframe>
</div>


<!--  ... ETC. ...  -->

</div>

</body>
<script>

$$script::pc_location.js<<
$$script::crypto-global.js<<
$$script::base64.js<<
$$script::crypto-hash.js<<
$$script::crypto-wraps.js<<
$$script::common.js<<
$$script::https_checks.js<<
$$script::post_fetch.js<<
$$script::file_ops.js<<
$$script::one_table_db.js<<
$$script::app-dir/user_db.js<<
$$script::for-humans/shared_constants.js<<
$$script::for-humans/human_frame_client.js<<
$$script::for-humans/frame_page_tab_com.js<<
$$script::app-dir/window_app.js<<

</script>

```


In the above code, one can see the **variable forms** such as `{{canonical}}`, while for this project all the **link forms**
are in the script section. This project does no use more HTML than provided in the file.

But, it does bring in scripts. It does not necessarily bring in all the scripts or even all of each script. The *alpha* field of a configuration object determines how much of the listed scripts to include. 

Here is a configuration file for the human frame.

```
{
    "alpha" : {
        "pre_template" : "[alpha-copious]/pre-template/human_page.html",
        "business_url" : "copious.world",
        "out_dir" : "./templates",
        "key_values" : {
            "$$AUTHOR" : "Richard Leddy",
            "INSERT" : ""
        },
        "path_abreviations" : {
            "[alpha-copious]" : "[github]/alphas/alpha-copious",
            "[github]" : "~/Documents/GitHub",
            "[app-local]" : "[github]/alphas/of-this-world"

        },
        "ext_default_dir" : {
            ".html" : "[alpha-copious]/html",
            ".js" : "[alpha-copious]/client",
            ".svg" : "[alpha-copious]/icons"
        },
        "top_dir_location" : {
            "script" : "[alpha-copious]/script",
            "for-humans" : "[alpha-copious]/for-humans",
            "html" : "[alpha-copious]/html",
            "app-dir" : "[app-local]/scripts"
        },
        "files" : {
            "index.html" : {
                "footer_A.html" : 6,
                "name::about_box" : {
                    "file" : "fadable_box.html",
                    "key_values" : {
                        "Z_INDEX" : 102,
                        "BOX_NAME" : ">name"
                    }
                },
                "intergalactic-explain.html" : "1",
                "script" : {
                    "pc_location.js" : 1,
                    "crypto-global.js" : 1,
                    "base64.js" : 1,
                    "crypto-wraps.js" : 1,
                    "crypto-hash.js" : 1,
                    "common.js" : 2,
                    "field_checks.js" : 3,
                    "https_checks.js" : 4,
                    "post_fetch.js" : {
                        "order" : 14,
                        "include" : ["postData"],
                        "exclude" : false
                    },
                    "uploader_class.js" : 6,
                    "file_ops.js" : 1,
                    "one_table_db.js" : 1,
                    "script/flexy_items_A-animation.js" : 12,
                    "for-humans/human_frame_client.js" : 1,
                    "for-humans/external-id-intake.js" : 13,
                    "for-humans/frame_page_opener.js" : 1,
                    "for-humans/frame_page_tab_com.js" : 1,
                    "app-dir/user_db.js" : 2,
                    "for-humans/shared_constants.js" : 1,
                    "app-dir/window_app.js" : 2
                }
            }
        }
    }
}

```

This project only makes a template and leaves a later process to fill it out. So, there is no **beta** field. But, there is an **alpha** field.

Notice that the **alpha** field begins with the field **pre_template**. That is the file above. Look at the **[alpha-copious]** form in the directory path. This is a path abbreviation. The path form substitution rules are listed in the **alpha** object under the fields **path_abreviations** and **top_dir_location**. The expand bottom up.

Under the **files** field, are fields whose keys are the names of files being generated. This configuration will generate **index.html**. Some HTML files are lists under **index.html**. But, these files are not mentioned in the pre-template being used, so they will be ignored. This example is only concerned with the inclusion of JavaScript.

In the `<script>` section, all the files that might go into the pre-template are given. There are a few that won't be used by the pre-template. In general, the file has to be listed by both the pre-template and the configuration to be included. The only assurance is that file depencies are included. So, a file that is not listed in either the pre-template or the configuration but that a file being included requires to operate, that file will be included as well.

Notice the **post_fetch** inclusion:

```
                    "post_fetch.js" : {
                        "order" : 14,
                        "include" : ["postData"],
                        "exclude" : false
                    },
```

This inclusion shows just one function, **postData**, being included in the project. The source of post_fetch lists the set of functions it exports. And, the "post_fetch.js" field value is a selector of the method. Other methods will not be included from the file unless there are dependencies.

Some of the files listed in the field names are file paths. For example, `for-humans/human_frame_client.js` seems to indicate that a directory "for-humans" will be used. But, in fact, the directory is defined by the top-dir fields and the abbreviations as such:

```
 "for-humans" : "[alpha-copious]/for-humans",
```

This form is expanded further until an absolute path is determined.


This example did not use the file form. Here is an example of that:

```
$$files::nav_bar_A.html<<
```

The file version of the **link form** uses the **ext_default_dir** field to establish the location of the file based on the extension. In the file form example, **roll-right** will look for `nav_bar_A.html` in the directory `[alpha-copious]/html` once the path variable `[alpha-copious]` is expanded.

## How it Helps

This tool is not a replacement for final publication steps enabled by rollup, browserify, or others. Instead, this stool may generate code that will be sumbitted to those tools.

In fact, whole pages needing no further manipulation may be generated by this tool. So, in some cases this tool does the job that others do. However, some build systems use the other tools to generate their final runtime products. And, this tool may be upstream from those tools.

In particular, this tool addresses moving preexisting code into certain packaged contexts at the source level. Other packages rollup modules into single code sets or module collections into one file. 

This tool can be used to replicate code into projects, allowing for function by function selection. The final output will be a combined source file with a chain of support for working code. That is, a developer may request that a whole module be copied into a combined source file for a project, or he may select some functions to be placed into the combined source file. But, he may expect that the functions included will have their supporting functions brought in as well.

More commonly, this tool is useful for creating web pages that host bundled operations and that provide basic common libraries that will not be accessed on the global (window) level. In the sense that a browser provides a common library accessible to all parts of a project, a window can offer an extension of that capability. The extension is mostly a packaging of that capability into simpler calls.

One may ask why one would allow code (fixed version) to be copied into a number of projects without creating a module publication. The answer has more to do with expediency of project creation with some time being taken to decide what is a maintable module. The tool will copy just one function from a group of functions into a project if that is specified. But, when the module is maintained, the tool may copy all the function of a group into the new module and ready the code for publication. Projects that use the module will import all the functions in some sense into their code. Certainly, down stream tree shaking may work to reduce the number of functions included. But, that may just move certain worries down stream.

So, there are options for deciding how alpha code will be included in projects. But, this tool also provides generation based on skeletons.

In order to create a template, this tool reads a skeleton file and a JSON configuration that describes how to select alpha code and use some or all of the skeleton to create an .html file that has code and variables, where the mark the place where final code will be placed.


## Setting up publisher calls in a node.js module

First install the command line version of roll-right.




