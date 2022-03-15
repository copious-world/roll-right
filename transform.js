const fs = require('fs');
const path = require('path')

//function stay_healthy_function() {}
// https://www.youtube.com/watch?v=s86-Z-CbaHA

// FROM STACK EXCHANGE
Object.defineProperty(global, '__stack', {
    get: function() {
            var orig = Error.prepareStackTrace;
            Error.prepareStackTrace = function(_, stack) {
                return stack;
            };
            var err = new Error;
            Error.captureStackTrace(err, arguments.callee);
            var stack = err.stack;
            Error.prepareStackTrace = orig;
            return stack;
        }
    });
    
    Object.defineProperty(global, '__line', {
    get: function() {
            return __stack[1].getLineNumber();
        }
    });
    
    Object.defineProperty(global, '__function', {
    get: function() {
            return __stack[1].getFunctionName();
        }
});
    
/*
    function foo() {
        console.log(__line);
        console.log(__function);
    }
*/
    

function die(msg) {
    console.log(msg)
    console.log("terminating")
    try {
        stay_healthy_function()
    } catch (e) {
        console.error(e)
        process.exit(0)
    }
}

//$?SUBST??:post_fetch.js?$    // examples
//
const g_subst_tag = '//$?SUBST??:'
const g_export_tag = '//$$EXPORTABLE::'

//
let import_dir = "./client" // default to html generation


function subst_str(istr,symbol,value) {
    let in_parts = istr.split(symbol)
    if ( in_parts.length === 1 ) {
        return istr
    }

    let out_parts = []
    out_parts.push(in_parts.shift())
    while ( in_parts.length ) {
        let opart = value + in_parts.shift()
        out_parts.push(opart)
    }

    let output = out_parts.join('')
    return output
}


function extact_expr(symbol_ky,boundries) {
    let c1 = boundries[0]
    let c2 = boundries[1]
    let p1 = symbol_ky.indexOf(c1)
    if ( p1 > 0 ) {
        let p2 = symbol_ky.lastIndexOf(c2)
        let expr_str = symbol_ky.substr((p1+1),(p2 - p1 - 1))
        return expr_str
    }
    return('')
}

function subst_mode_files(template_str,filler) {
    if ( !template_str || (typeof template_str !== 'string') || (template_str.length < 3) ) {
        die(`in: ${__function} :${__line}:: input is not long enough to operate`)
    }
    let parts = template_str.split(g_subst_tag)
    if ( parts.length === 0 ) {
        die(`in: ${__function} :${__line}:: failure in split function`)
    }
    if ( parts.length === 1 ) {
        return template_str     // no subsitutions
    }
    //
    let new_parts = []
    new_parts.push(parts.shift())
    let char_count = new_parts[0].length

    while ( parts.length ) {
        let part = parts.shift()
        char_count += part.length
        let stopper = part.indexOf('?$')
        if ( stopper < 3 ) {    // a.b at least... has to be a file name with an extension
            die(`in: ${__function} :${__line}:: char ${char_count} substitution not defined`)
        }
        //
        let fname = part.substr(0,stopper)
        let rest = part.substr(stopper + 2)

        let subst = filler[fname]
        new_parts.push('\n' + subst + '\n' + rest)
        //
    }

    let output = new_parts.join('')
    return(output)
}



function prep_for_export_import(target_file_contents) {
    if ( !target_file_contents || (typeof target_file_contents !== 'string') || (target_file_contents.length < (g_export_tag.length + 60)) ) {
        die(`in: ${__function} :${__line}:: input is not long enough to operate`)
    }
    // gather all the export names or expressions
    let parts = template_str.split(g_export_tag)
    if ( parts.length === 0 ) {
        die(`in: ${__function} :${__line}:: failure in split function`)
    }
    if ( parts.length === 1 ) {
        return template_str     // no subsitutions
    }
    //
    let new_parts = []
    let all_exports = []
    new_parts.push(parts.shift())
    while ( parts.length ) {
        let part = parts.shift()
        // go to next comment and take in the comment
        part = part.trim()
        let cloc = part.indexOf('/*')
        if ( cloc >= 0 ) {
            part = part.trim().substr(cloc+2)
            cloc = part.indexOf('*/') 
            let exports = part.substr(0,cloc)
            part = part.substr(cloc+2)
            part += '/n'
            new_parts.push(part)
            exports = exports.split('\n')
            all_exports = all_exports.concat(exports.map(ln => { return(ln.trim())} ))
        }
    }
    // 
    let output = new_parts.join('\n')
    let unique_exports = {}
    all_exports.forEach(exprt => {
        unique_exports[exprt] = 1
    })
    //
    let explist =  Object.keys(unique_exports)
    if ( explist.length === 0 ) {
        return(output)
    }
    //
    let explist_str = explist.join(', ')
    let exporter = `export { ${explist_str} };`
    output += `
${exporter}
    `
    //
    return(output)
}


function extract_fields_forms(tmplt) {
    return tmplt.match(/{{\w*}}/g)
}


function key_complexity(k1,k2) {
    let cplx_cnt_1 = 0
    let cplx_cnt_2 = 0
    for ( let i = 0; i < k1.length; i++ ) {
        let c = k1[i]
        if ( '{[$'.includes(c) ) cplx_cnt_1++
        if ( '{['.includes(c) ) cplx_cnt_1++
    }
    for ( let i = 0; i < k2.length; i++ ) {
        let c = k2[i]
        if ( '{[$'.includes(c) ) cplx_cnt_2++
        if ( '{['.includes(c) ) cplx_cnt_2++
    }
    return(cplx_cnt_2 - cplx_cnt_1)
}





///  TAKE THE NAME OF THE CONFIG FILE FROM COMMAND LINE   node transform myfile.json  (or other ext)

let input_file = process.argv[2]

console.log(input_file)

let data = fs.readFileSync(input_file).toString()
data = JSON.parse(data)
//
console.dir(data)


/*

{
    "businesses" : [
        "copious.world",
        "popsong.now"
    ],
    "in_dir" : "string",
    "out_dir" : "string/${business_key}",
    "file1-eg" : {
        "out_dir"  : "special-case/${business_key}",
        "special_items" : true,
        "array" : "JSON FILE THAT IS ARRAY/${business_key}"
        "input" : "a file name in in-dir :: a template file"
    },
    "file2-eg" : {
        "out_dir"  : "special-case/${business_key}",
        "special_items" : true,
        "array" : "JSON FILE THAT IS ARRAY/${business_key}"
        "input" : [
            "a file name in in-dir :: a template file",
            "a file name in in-dir :: a template file"
        ]
    },
    "file3" :  : {
        "out_dir"  : false,
        "special_items" : false,
        "input" : "a file name in in-dir :: a template file",
        "import" : {
            "inmport-file-name" : {

            }
        },
        "import_app" : {

        },
        "subst_l1" : {
            
        }
    },
    "file3" : {}
}

*/

let businesses = data.businesses
let input_dir = data.in_dir
let out_dir = data.out_dir

delete data.businesses
delete data.in_dir
delete data.out_dir

for ( let business of businesses ) {
    //
    console.log(business)
    for ( let filename in data ) {
        let descr = data[filename]
        let odir = out_dir.replace("${business_key}",business)
        if ( descr.out_dir !== undefined ) {
            odir = descr.out_dir.replace("${business_key}",business)
        }
        if ( (descr.special_items !== undefined) && descr.special_items ) {
            console.log(filename)
            console.log(odir)
            //
            let item_input = descr.array.replace("${business_key}",business)

            try {       // read in the files that will have parts inserted
                let ifile = item_input
                let item_list = fs.readFileSync(ifile).toString()
                item_list = JSON.parse(item_list)
                // fail if not array
                //
                if ( typeof descr.input === "string" ) {
                    let out_parts = []
                    let tmplt_file = input_dir + descr.input
                    let tmplt = fs.readFileSync(tmplt_file).toString()  // THE TEMPLATE FILE
                    // build an array of targets
                    let field_fs = extract_fields_forms(tmplt)
                    let fields = field_fs.map( fld => { return(fld.replace("{{",'').replace("}}",''))} )
    
                    for ( let item of item_list ) {
                        let o_item = ''
                        //
                        o_item += tmplt   // a string copy (reusing the template)
                        for (let i = 0; i < field_fs.length; i++ ) {
                            let fld = fields[i]
                            let repl_fld = field_fs[i]
                            let value = decodeURIComponent(item[fld])
                            value = value === undefined ? "" : value
                            o_item = o_item.replace(repl_fld,value)
                        }
                        //
                        out_parts.push(encodeURIComponent(o_item))
                    }

                    let output = out_parts.join('')
                    let outfile = odir + filename
                    console.log(outfile)
                    fs.writeFileSync(outfile,output)

                } else {
                    if ( Array.isArray(descr.input) ) {
                        descr.input.forEach(file => {
                            out_parts = []
                            let tmplt_file = input_dir + file
                            //
                            let tmplt = fs.readFileSync(tmplt_file).toString()
                            let field_fs = extract_fields_forms(tmplt)
                            let fields = field_fs.map( fld => { return(fld.replace("{{",'').replace("}}",''))} )
                            //
                            let output_descr = descr.output[file]
                            if ( output_descr === undefined ) return
                            //
                            for ( let item of item_list ) {
                                let o_item = ''
                                if ( output_descr.reject !== undefined ) {
                                    let check_r = item[output_descr.reject]
                                    if ( (check_r !== undefined) && check_r ) {
                                        continue
                                    }
                                }
                                // "reject" : "no_subst"
                                if ( item.no_subst ) {
                                    let nosubst_desc = descr.no_subst
                                    let wrap = input_dir + nosubst_desc.wrapper
                                    let tmplt_w = fs.readFileSync(wrap).toString()
                                    let field_fs_w = extract_fields_forms(tmplt_w)
                                    let fields_w = field_fs_w.map( fld => { return(fld.replace("{{",'').replace("}}",''))} )
                                    o_item += tmplt_w
                                    for (let i = 0; i < field_fs_w.length; i++ ) {
                                        let fld = fields_w[i]
                                        let repl_fld = field_fs_w[i]
                                        let value = decodeURIComponent(item[fld])
                                        value = value === undefined ? "" : value
                                        o_item = o_item.replace(repl_fld,value)
                                    }
                                } else {
                                    o_item = '' + tmplt
                                    for (let i = 0; i < field_fs.length; i++ ) {
                                        let fld = fields[i]
                                        let repl_fld = field_fs[i]
                                        let value = decodeURIComponent(item[fld])
                                        value = value === undefined ? "" : value
                                        o_item = o_item.replace(repl_fld,value)
                                    }
                                }
                                if ( output_descr.encoded ) {       // list of output parts
                                    out_parts.push(encodeURIComponent(o_item))
                                } else {
                                    out_parts.push(o_item)
                                }
                            }
                            //
                            let output = out_parts.join('')
                            let outfile = odir + output_descr.file 
                            console.log(outfile)
                            fs.writeFileSync(outfile,output)
                            //
                        })
                    }
                }

            } catch(e) {
                console.log(e)
            }

        } else {
            //console.dir(descr)
            //
            let template_file = (input_dir + descr.input)
            let template_str = fs.readFileSync(template_file).toString()
            //
            // descr.input ... input the files...
            let file_map = descr.import
            let filler_data = {}
            for ( let fname in file_map ) {
                // '*' for all otherwise filters....
                let filter_list = file_map[fname]
                if ( filter_list === '*' ) {  // put entire in_str in place of the subst tag
                    let indir =  ( fname[0] === '.' ) ? '' : input_dir
                    let str_from_file = fs.readFileSync(indir + fname).toString()
                    let key_fname = path.basename(fname)
                    filler_data[key_fname] = str_from_file
                } else {
                    // not implemented
                }
            }
            //
            let template_str_2 = subst_mode_files(template_str,filler_data)

            if ( descr.import_app !== undefined ) {
                for ( let import_ky in descr.import_app ) {
                    let fname = descr.import_app[import_ky]
                    let import_str = fs.readFileSync(input_dir + fname).toString()
                    template_str_2 = template_str_2.replace(import_ky,import_str)
                }
            }

            let output = template_str_2
            //
            if ( descr.subst_l1 !== undefined ) {
                //
                let template_str_3 = template_str_2
                //
                let encoded_fields = descr.decode
                let symbolic_keys = Object.keys(descr.subst_l1)
                symbolic_keys.sort(key_complexity)
                for ( let symbol_ky of symbolic_keys ) {
                    //
                    let value = descr.subst_l1[symbol_ky]
                    //
                    if ( symbol_ky.includes('{') ) {
                        let smap = value
                        if ( symbol_ky.includes('{}') ) {
                            for ( let symb_ky in smap ) {
                                let value = smap[symb_ky]
                                let nxt_symbol = symbol_ky.replace('{}',`[${value}]`)
                                template_str_3 = subst_str(template_str_3,nxt_symbol,value)
                            }
                        } else {
                            let sym_formula = extact_expr(symbol_ky,'{}')
                            let value = descr.subst_l1[sym_formula]
                            if ( value !== undefined ) {
                                //
                                if ( sym_formula.includes('[]') ) {
                                    let value_ky_list = descr.subst_l1[sym_formula]
                                    let n = value_ky_list.length
                                    for ( let i = 0; i < n; i++ ) {
                                        let v_ky = value_ky_list[i]
                                        let value = smap[v_ky]
                                        let sym_formula_i = sym_formula.replace('[]',`[${i}]`)
                                        let sym_map_key = symbol_ky.replace(sym_formula,sym_formula_i)
                                        template_str_3 = subst_str(template_str_3,sym_map_key,value)
                                    }
                                } else {
                                    let value = smap[value]
                                    let nxt_symbol = symbol_ky.replace('{}',`[${value}]`)
                                    template_str_3 = subst_str(template_str_3,nxt_symbol,value)
                                }
                                //
                            }
                        }
                    } else if ( symbol_ky.includes('[') ) {
                        let vlist = value
                        let n = vlist.length
                        for ( let i = 0; i < n; i++ ) {
                            let nxt_symbol = symbol_ky.replace('[]',`[${i}]`)
                            let value = vlist[i]
                            template_str_3 = subst_str(template_str_3,nxt_symbol,value)
                        }
                    } else {
                        if ( encoded_fields.indexOf(symbol_ky) >= 0 ) {
                            value = decodeURIComponent(value)
                        }
                        template_str_3 = subst_str(template_str_3,symbol_ky,value)
                    }
                }
                output = template_str_3
            }

            let outfile = odir + filename
            console.log(outfile)
            fs.writeFileSync(outfile,output)
            //
        }
    }
    //
}