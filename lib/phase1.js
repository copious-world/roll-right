
const fs = require('fs-extra')
const path = require('path')
const untildify = require('untildify')
const {translate_marker} = require('../lib/utils')

//$$files::header.html<<
const g_inserts_match = /\$\$files\:\:(\w|_|-|\+)+\/*(\w|_|-|\+)+\.(\w|_|-\+)+\<\</g 
const g_names_inserts_match = /\$\$files\:\:name\:\:(\w|_|-|\+)+\/*(\w|_|-|\+)+\<\</g

translate_marker
// ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
//

function subst(fdata,key,value) {
    while ( fdata.indexOf(key) >= 0 ) {
        fdata = fdata.replace(key,value)
    }
    return fdata
}


function mapify(a1,a2,key_edit) {
    let the_map = {}
    let n = a1.length
    if ( typeof key_edit === 'function' ) {
        for ( let i = 0; i < n; i++ ) {
            let ky = key_edit(a1[i])
            the_map[ky] = a2[i]
        }
    } else {
        for ( let i = 0; i < n; i++ ) {
            the_map[a1[i]] = a2[i]
        }    
    }
    return the_map
}


function find_map(part_form,the_map) {

    let key = part_form.substr(0,part_form.indexOf("<<")).trim()
    if ( key.length === 0 ) {
        //console.log(part_form)
    }

    let data = the_map[key]

    return[key,data]
}



function key_map_sub(file_data,key_values,vars) {
    let fdata = '' + file_data
    for ( let key in key_values ) {
        let value = key_values[key]
        if ( value[0] === '>' ) {
            let varname = value.substr(1)
            let i = vars.indexOf(varname)
            if ( i >= 0 ) {
                value = vars.substr(i + varname.length + '::'.length)
                if ( value.indexOf('::') > 0 ) {
                    value = value.substr(0,value.indexOf('::'))
                }
                value = value.trim()
            }
        }
        fdata = subst(fdata,`$$${key}`,value)
    }
    //
    return fdata
}



function windows_module(file_data) {
    let lines = file_data.split('\n')
    lines = lines.map(line => {
        if ( /\/\/\s+MODULE\:/.test(line) ) {
            return line.replace('(modularized)','(windowized)')
        } else if ( /import\s+\{/.test(line) ) {
            return ""
        } else if ( /^import\s+\* as\s+.+\s+from/.test(line) ) {
            return ""
        } else if ( /^export\s+function/.test(line) ) {
            return line.replace('export',"").trim()
        } else if ( /^export\s+async\s+function/.test(line) ) {
            return line.replace('export',"").trim()
        } else if ( /\/\/windowize>>/.test(line) ) {
            return line.replace('//windowize>>','')
        }
        return line
    })

    return lines.join('\n')
}



function file_transformations(transforms,file_data) {
    if ( Array.isArray(transforms) ) {
        for ( let trans of transforms ) {
            file_data = file_transformations(trans,file_data)
        }
    } else if ( typeof transforms === "string" ) {
        switch ( transforms ) {
            case "windowize" : {
                file_data = windows_module(file_data)
                break;
            }
            default : {
                break;
            }
        }
    }

    return file_data
}


function alphas_file_paths(clean_key,conf) {
    console.log("alphas_file_paths: " + clean_key)
    let the_file = ""
    if ( (clean_key.indexOf('/') > 0) && (clean_key[0] !== '[') ) {
        let top_dir = clean_key.substr(0,clean_key.indexOf('/'))
        let tdir = conf.top_dir_location[top_dir]
        tdir = tdir === undefined ? `./top_dir` : tdir
        the_file = clean_key.replace(top_dir,tdir)
        the_file = translate_marker(the_file,conf)
    } else if ( (clean_key.indexOf('/') > 0) && (clean_key[0] === '[') ) {
        // 
        the_file = translate_marker(clean_key,conf)
    } else {
        let ext = path.extname(clean_key)
        let src_dir = conf.ext_default_dir[ext]
        the_file = src_dir + '/' + clean_key
        the_file = translate_marker(the_file,conf)
    }
    return the_file
}


function sub_file_replace(file_data,defs,conf) {
    for ( let file in defs ) {
        try {
            let the_file = alphas_file_paths(file,conf)
            let sub_file = fs.readFileSync(the_file).toString()
            let marker = `$$file::${file}<<`
            file_data = file_data.replace(marker,sub_file)
        } catch(e) {
        }
    }
    return file_data
}



function sub_file_processing(clean_key,file_def,conf) {
    let the_file = alphas_file_paths(clean_key,conf)
    try {
        let file_data = fs.readFileSync(the_file).toString()
        if ( typeof file_def === 'object' ) {
            file_data = sub_file_replace(file_data,file_def,conf)
        }
        return file_data    
    } catch (e) {
        console.log(e)
    }
    return ""
}


function file_replacement(key_string,conf,file_key) {
    let file_map = conf.files
    let file_defs = file_map[file_key]
    let clean_key = key_string.replace("$$files::","")
    clean_key = clean_key.replace("<<",'')
    return sub_file_processing(clean_key,file_defs[clean_key],conf)
}


function named_replacer_replacement(key_string,conf,file_key) {
    let file_map = conf.files
    let file_defs = file_map[file_key]

    let clean_key = key_string.replace("$$files::","")
    clean_key = clean_key.replace("<<",'')
    let named_file_def = file_defs[clean_key]
    let ext = path.extname(named_file_def.file)
    let src_dir = conf.ext_default_dir[ext]
    let the_file = src_dir + '/' + named_file_def.file
    //
    console.log(the_file)
    if ( the_file[0] === '[' ) {
        the_file = translate_marker(the_file,conf)
    }
    try {
        let file_data = fs.readFileSync(the_file).toString()
        //
        if ( typeof named_file_def.key_values === 'object' ) {
            file_data = key_map_sub(file_data,named_file_def.key_values,clean_key)
        }
        //
        return file_data    
    } catch (e) {
        console.log(e)
    }
    return ""
}



function filter_file_data(file_data,script_filters) {
    let exclusions = script_filters.exclude
    let inclusions = script_filters.include
    let transforms = script_filters.transforms

    if ( transforms ) {
        file_data = file_transformations(transforms,file_data)
    }

    let file_data_update = ""

    let exportations = file_data.split('$$EXPORTABLE::')[1]
    if ( exportations ) {
        //
        exportations = exportations.trim()
        exportations = exportations.replace('/*','').replace('*/','').trim()
        exportations = exportations.split('\n')
        exportations = exportations.map(line => { return line.trim() })

        //
        if ( exclusions === '*' ) return ""
        if ( inclusions === '*' ) return file_data
        if ( exclusions ) {
            exportations = exportations.filter((exprt) => { return (exclusions.indexOf(exprt) < 0) })
        }
        if ( inclusions ) {
            exportations = exportations.filter((exprt) => { return (inclusions.indexOf(exprt) >= 0) })
        }
        //

        let file_parts = file_data.split('//$>>')
        file_data_update = file_parts.shift()
        let file_parts_map = {}
        for ( let part of file_parts ) {
            let key = part.substr(0,part.indexOf('\n'))
            key = key.trim()
            file_parts_map[key] = '//$>>' + part
        }

        for ( let ky of exportations ) {
            file_data_update += file_parts_map[ky]
        }
        //
    } else {
        file_data_update = file_data
    }

    return file_data_update
}



function oneof_absolutes(conf,the_key) {
    if ( the_key[0] === '<' )  {
        let abss = conf.absolutes
        for ( let abKy in abss ) {
            if ( the_key.indexOf(abKy) === 0 ) {
                return abss[abKy]
            }
        }
    }
    return false
}


function load_scripts(conf,file_key) {
    //
    let file_map = conf.files
    let file_defs = file_map[file_key]
    let script_list = file_defs.script
    //
    // script_list
    let the_file = ""
    let the_map = {}
    for ( let clean_key in script_list ) {
        let fkeys = oneof_absolutes(conf,clean_key)
        if ( fkeys ) {      // check for a kind of absolute path spec
            the_file = fkeys.root + '/'  + fkeys.offset
        } else {
            if ( clean_key.indexOf('/') > 0 ) {     // assume a selected directory by offset from call location
                the_file = alphas_file_paths(clean_key,conf)
            } else {        // get a default location for types of files...
                let ext = path.extname(clean_key)
                let src_dir = conf.ext_default_dir[ext]
                the_file = src_dir + '/' + clean_key
                the_file = translate_marker(the_file,conf)
            }
        }
        console.log(the_file)
        if ( the_file[0] === '[' ) {
            the_file = translate_marker(the_file,conf)
        }
        try {
            let file_data = fs.readFileSync(the_file).toString()
            let m_file_key = `script::${clean_key}`
            //
            let script_filters = script_list[clean_key]
            if ( typeof script_filters === "object" ) {
                file_data = filter_file_data(file_data,script_filters)
            }
            //
            the_map[m_file_key] = file_data
        } catch (e) {
            console.log(e)
        }
    }
    //
    return the_map
}

// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----


class Phase1 {

    constructor(target,target_conf) {
        this.tconf = target_conf
        this._target = target
    }

    ensure_directory(out_dir,target) {
        fs.ensureDirSync(`${out_dir}/${target}`)
    }


    config(conf,current_file_key) {
        console.log(conf.business_url)
        console.log(conf.pre_template)
    
        let tmpl_file = conf.pre_template 
        if ( tmpl_file[0] === '[' ) {
            tmpl_file = translate_marker(tmpl_file,conf)
        }
        try {
            let html_def = fs.readFileSync(tmpl_file,'utf8').toString()
            //
            let replacers = html_def.match(g_inserts_match)
            let named_replacers = html_def.match(g_names_inserts_match)
    
            //
            console.log("FILES file_replacement")
            let key_map_replacers = {}
            if ( !!replacers ) {
                let replacers_content = replacers.map((key_string) => {
                    return file_replacement(key_string,conf,current_file_key)
                })
        
                key_map_replacers = mapify(replacers,replacers_content,(key) => { return key.replace('$$','').replace('<<','') } )    
            }


            let key_map_named_replacers = {}
            if ( !!named_replacers ) {
                console.log("NAMED FILES named_replacer_replacement")
                let named_replacers_content = named_replacers.map((key_string) => {
                    return named_replacer_replacement(key_string,conf,current_file_key)
                })
                key_map_named_replacers = mapify(named_replacers,named_replacers_content,(key) => { return key.replace('$$','').replace('<<','')} )    
            }
    
            console.log("SCRIPTS load_scripts")
            let script_map = load_scripts(conf,current_file_key)
    
            let key_map_all = Object.assign({},key_map_replacers,key_map_named_replacers,script_map)
    
            //console.dir(key_map_all)
            console.dir(Object.keys(key_map_all))
            //
            let results = []
            let leaders = html_def.split('$$')
            results.push(leaders.shift())
            //
            //
            for ( let nextL of leaders ) {
                let [key,found_sub] = find_map(nextL,key_map_all)
                console.log(key)
                let matcher = `${key}<<`
                let sub_file = nextL.replace(matcher,found_sub)
                results.push(sub_file)
            }
    
            let sdata = results.join('\n')
    
            let output_file = conf.out_dir + '/' + this._target + '/' + current_file_key
            fs.writeFileSync(output_file,sdata)
    
        } catch(e) {
            console.log("TEMPLATE: " + tmpl_file + " does not exists or does not have permissions or is not formatted correctly")
            console.log(e)
        }
    }
    
    

    run() {
        this.ensure_directory(this.tconf.out_dir,this._target)
        for ( let file in this.tconf.files ) {
            this.config(this.tconf,file)
        }
    }


}

module.exports = Phase1