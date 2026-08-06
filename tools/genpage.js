const fs = require('fs')
const path = require('path');
const Handlebars = require('handlebars')            // USES HANDLEBARS
//
//
let SysUtils = require('../lib/sys_utils')
let sys_utils = new SysUtils({
    "tools_directory" : `.`
})



// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

function  extension_from_path(src) {
    let srcext = path.extname(src)
    if ( srcext.length === 0 ) {
        srcext = 'text'
    }
    srcext = srcext.replace('.','')
    return srcext
}


function reset_svg_height_width(svg_txt, output_width, output_height) {
    let svg_tag_start = svg_txt.indexOf("<svg")
    let svg_tag_end = svg_txt.indexOf(">",svg_tag_start)
    let tag_text = svg_txt.substr(svg_tag_start,(svg_tag_end - svg_tag_start + 1))
    //
    if ( output_width ) {
        tag_text = tag_text.replace(/width=".*"/,`width="${output_width}"`)
    }
    if ( output_height ) {
        tag_text = tag_text.replace(/height=".*"/,`height="${output_height}"`)
    }
    svg_txt = svg_txt.substring(0, svg_tag_start) + tag_text + svg_txt.substring(svg_tag_end + 1);
    //
    return(svg_txt)
}



/**
 * Returns true if this object passed has fields specifying a file to be read.
 * 
 * 
 * @param {object} descr 
 * @returns {boolean}
 */
function is_file_source(descr) {
    return ((typeof descr === 'object') && ( descr.file || ( descr.content && descr.content.file ) || ( descr.button && descr.button.file ) ))
}

function is_loop_data_consumer(descr) {
    return ( (typeof descr === 'object') && ((descr["$_data_source"] !== undefined) && (descr["$_looping"] !== undefined)) )
}


var g_compiler_schedule = []
/**
 * Given a descriptor of a file to load and read, this function reads the 
 * file, and provides the descriptor with the data for later compilation and substitution.
 * 
 * @param {object} datObj 
 * @param {object} descr 
 */
function process_sub_content(datObj,descr) {
    let src_file = descr.file ? descr.file : ( descr.content ? descr.content.file : descr.button.file );
    try {
        if ( src_file[0] === '.' ) {
            src_file = datObj.srcPath + src_file.substr(1)
        }
        let just_loaded_src = fs.readFileSync(src_file,'utf8').toString()       // READ THE FILE SOURCE
        //
        let operator = { 'data' : datObj, 'source' : just_loaded_src, 'target' : descr }
        //
        if ( descr.button && descr.button.file ) {
            operator.target = descr.button
        }
        let ext = extension_from_path(src_file)
        descr.ext = ext
        if ( ext === "svg" ) {
            if ( descr.output_height || descr.output_width ) {
                operator.alteration = (content) => {
                    return(reset_svg_height_width(content, descr.output_width, descr.output_height))  
                }
            }
        }
        g_compiler_schedule.unshift(operator)
    } catch (e) {
        g_forgotten_files.push(src_file)
        console.log(e.message)
    }
}




/**
 * 
 * @param {object|string|Array} _data_source 
 * @param {object} fields -- fields names to emptry strings or qualifiers... useful for scripts and services that filter
 * @param {string} loop_index 
 * @returns{Array}
 */
async function load_array_of_objects(_data_source,fields,loop_index) {
    // _data_source can be a file, an rcp link, shell file, etc
    let array_of_obj = [] // fs.readFileSync(_data_source)   /// if it is a file
    if ( typeof _data_source === "object" ) {
        if ( Array.isArray(_data_source) ) {
            array_of_obj = _data_source
        } else {
            switch (_data_source.type ) {
                case "file": {
                    try {
                        let array_of_obj_str = fs.readFileSync(_data_source.file).toString()
                        array_of_obj = JSON.parse(array_of_obj_str)
                    } catch (e) {
                        array_of_obj = []
                    }
                    break;
                }
                case "script" : {
                    try {
                        let c = Buffer.from(JSON.stringify(fields))
                        let field_info = c.toString('base64url')
                        let pars = field_info + (loop_index ? (' ' + loop_index) : "")
                        let data_str = sys_utils.bash_command(_data_source.file,pars)
                        data_str = data_str.toString()
                        if ( data_str && data_str.length ) {
                            try {
                                return JSON.parse(data_str)
                            } catch (e) {
                            }
                        }
                    } catch (e) {
                        array_of_obj = []
                    }
                    break
                }
                case "service" : {
                    break
                }
            }            
        }
    }
    if ( loop_index !== false ) {
        let j = 1
        for ( let item of array_of_obj ) {
            item[loop_index] = j++
        }
    }
    return array_of_obj
}

/**
 * 
 * "sidebar_sections": {
        "list": [],
        "fields": {
            "_type<array>" : "list",
            "index++": "",
            "button_list": {
                "content": ""
            },
            "subjects": ""
        },
        "$_looping": "index++",
        "$_data_source": ""
    },
 * 
 * @param {object} datObj 
 * @param {object} descr 
 */
async function process_looped_sub_content(datObj,descr) {
    //
    let loop_index = descr.$_looping ?  descr.$_looping : false
    let array_of_obj = await load_array_of_objects(descr.$_data_source,descr.fields,loop_index)
    let array_fld = descr.fields["_type<array>"]
    descr[array_fld] = array_of_obj
    //
    let operator = { 'data' : datObj, 'source' : just_loaded_src, 'target' : descr }
    g_compiler_schedule.unshift(operator)
}


var g_forgotten_files = []
/**
 * Takes in a substitution descriptor and a source to apply it to.
 * It pushes the parmeters onto a stack of substitution directives, the compiler schedule.
 * Then, it looks in the substitution descriptor to find files that might be processed before
 * being placed into the final substitution yielding the output.
 * 
 * The order is important, most specific to least specific, that being the contents of the output file.
 * 
 * @param {object} datObj -- the same data object required by handlebars.js (or, more where some subobjects are passed as the data object)
 * @param {string} src 
 */
function load_source_data(datObj,src) {
    g_compiler_schedule.unshift({ 'data' : datObj, 'source' : src })  // recall this is push
    for ( let field in datObj ) {
        let descr = datObj[field]
        // it is possible that datObj has only top level variables with string values.
        // But, some may be arrays of objects, or just one data descriptor
        if ( (typeof descr === 'object') &&  Array.isArray(descr) ) {
            descr.forEach(element => {
                if ( is_file_source(element) ) {
                    process_sub_content(datObj,element)
                } else if ( is_loop_data_consumer(element) ) {
                    process_looped_sub_content(datObj,element)
                }
            })
        } else if ( is_file_source(descr) ) {
            process_sub_content(datObj,descr)
        } else if ( is_loop_data_consumer(descr) ) {
            process_looped_sub_content(datObj,descr)
        }
    }
}


// STARTS HERE...

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
let data_file = process.argv[2]     // a subst file
let source_file = process.argv[3]   // a template file
let output = process.argv[4]        // an html file -- the result of completing subsitutions from bottom to top.
let static_dir = process.argv[5]    // a directory containing assets (files) the will be emplaced in the final page
let concern = process.argv[6]
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----


console.log("SOURCE FILE: " + source_file)
console.log("STATIC DIR: " + static_dir)

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
var data = fs.readFileSync(data_file,'ascii').toString()
var confObj = JSON.parse(data)
//
confObj.srcPath = static_dir
var source = fs.readFileSync(source_file,'utf8').toString()
load_source_data(confObj,source)

//console.dir(confObj)
//

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
// compiler schedule is populated by `load_source_data`
// The compiler schedule organizes subsitution from lowest depth to tops
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
var result = "nothing"
g_compiler_schedule.forEach(operator => {
    //let operator = { 'data' : datObj, 'source' : src, 'target' : descr }
    let source = operator.source        // The operator source may belong to a file loaded as part of a content call
    let template = Handlebars.compile(source);  // compile some part of the file or the remaining top file
    let confObj = operator.data                 // the object whose keys are variable names
    //console.dir(confObj)
    let content = template(confObj);
    if ( operator.alteration ) {
        content = operator.alteration(content)
    }
    if ( operator.target ) {
        operator.target.content = content       // the target was established as a higher level subsitution
    }
    result = content
})


console.log("OUTPUT FILE: " + output)
fs.writeFileSync(output,result)

if ( g_forgotten_files.length ) {
    console.log("echo > " + g_forgotten_files.join('\necho > '))
}


// launch an optional copy to "concern"  
// A complete top down copy, inclucdes images, costum css, etc.
if ( concern !== undefined ) {
    let test_directory = `/var/www/html/${concern}/pre-staging`
    console.log("Launch copy from",output,"TO",test_directory)
}
