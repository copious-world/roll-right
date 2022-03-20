const fs = require('fs')
const untildify = require('untildify')


// // 
module.exports.load_json_file = (src) => {
    try {
        let contents = JSON.parse(fs.readFileSync(src).toString())
        return contents
    } catch (e) {
        console.log(e)
    }
}


// recursive_flat
function recursive_flat(ary) {
    if ( Array.isArray(ary) ) {
        let outary = []
        for ( let el of ary ) {
            if ( Array.isArray(el) ) {
                outary = outary.concat(recursive_flat(el))
            } else {
                outary.push(el)
            }
        }
        return outary
    } else {
        return ary
    }
}


module.exports.array_flatten = (items_array) => {
    let final_array = []
    for ( let item of items_array ) {
        if ( !Array.isArray(item) ) {
            final_array.push(item)
        } else {
            let ary = recursive_flat(item)
            final_array = final_array.concat(ary)
        }
    }
    return final_array
}

function pop_dir(where_am_i) {
    let last_dir = where_am_i.lastIndexOf('/')
    if ( last_dir > 0 ) {
        where_am_i = where_am_i.substr(0,last_dir)
    }
    return where_am_i
}

function default_realtive_asset_dir() {
    let where_am_i = __dirname
    let default_dir = pop_dir(where_am_i)
    return default_dir
}


function translate_marker(clean_key,conf) {
    if ( clean_key === "default" ) {
        clean_key = default_realtive_asset_dir()
    } else {
        let syntax_boundary = clean_key.indexOf(']')
        if ( syntax_boundary > 0 ) {
            let location_marker = clean_key.substr(0,syntax_boundary+1)
            let findable = conf.path_abreviations[location_marker]
            if ( findable ) {
                clean_key = clean_key.replace(location_marker,findable).trim()
                if ( clean_key[0] === '[' ) {
                    clean_key = translate_marker(clean_key,conf)
                } else if ( clean_key[0] === '~' ) {
                    clean_key = untildify(clean_key)
                }
            }
        }
    }
    return clean_key
}


module.exports.translate_marker = translate_marker
