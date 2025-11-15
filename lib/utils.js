const fs = require('fs')

/**
 * subst
 * 
 * Calls String.replace sequentially until no instances of the pattern are left.
 * Puts the value in place of the pattern.
 * 
 * Returns the string 
 * 
 * @param {string} str 
 * @param {string} pattern 
 * @param {string} value 
 * @returns string
 */
function subst(str,pattern,value) {
    let i = str.indexOf(pattern)
    let j = 0
    while ( i >= 0 ) {
        str = str.replace(pattern,value,j)
        j = i
        i = str.indexOf(pattern)
    }
    return str
}



/**
 * recursive_flat
 * 
 * Takes in an array whose elements are either atoms or arrays.
 * The structure is assumed to be recursive and have some max depth
 * not checked by this method.
 * 
 * @param {Array} ary 
 * @returns Array
 */
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



/**
 * array_flatten
 * 
 * A top level call for `recursive_flat`
 * 
 * @param {Array} items_array 
 * @returns Array
 */
function array_flatten(items_array) {
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


/**
 * mapify
 * 
 * Given two arrays creates an object whose keys are the to be found in the first array and the values in the second.
 * 
 * The method uses all the keys and as many values found at the front of the array. 
 * It is possible that the value array will be longer than the keys. If the value array is short, 
 * then key will map to 'undefined'.
 * 
 * 
 * 
 * @param {Array} a1 
 * @param {Array} a2 
 * @param {Function} key_edit
 * 
 * @returns Object
 */
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


/**
 * find_map
 * 
 * This is for an application that takes in a string that is expected to have 
 * a delimeter marking the end of the prefix (or first part) of the string.
 * 
 * It pulls of the prefix and uses it as a key into the map to get stored data. 
 * 
 * This returns key and data as a pair.
 * 
 * default "<<"
 * 
 * @param {string} part_form 
 * @param {object} the_map 
 * @param {string}
 * @returns pair<key,data>  -- this is an array with a key in position 0, and data in position 1
 */
function find_map(part_form,the_map,section_key) {
    
    if ( section_key === undefined ) {
        section_key = "<<"
    }

    let key = part_form.substring(0,part_form.indexOf(section_key)).trim()
    if ( key.length === 0 ) {
        //console.log(part_form)
    }

    let data = the_map[key]

    return[key,data]
}


/**
 * key_map_sub
 * 
 * Takes in a string `source_str`, which may be formatted with substitution forms.
 * The form '$${key}' is similar to the JavaScript substitution directive '${subsitution expre}'.
 * There is one extra '$' up front. The object contains key-value pairs.
 * 
 * In some cases, a value from the object may be a stored variable.
 * In this application, the value as variable is indicated by a character prefix. (default '>')
 * The vars parameter includes variable-value pairs allowing for substitutions specifically for a string 
 * outside the use of the key-value object. This provides override for globally set values.
 * 
 * 
 * @param {string} source_str 
 * @param {object} key_values 
 * @param {string} vars - a string of variable,value pairs delimited by the var_delimiter
 * @param {string} value_var_prefix (optional)
 * @param {string} var_delimiter 
 * @returns string
 */
function key_map_sub(source_str,key_values,vars,value_var_prefix,var_delimiter) {
    if ( value_var_prefix === undefined ) {
        value_var_prefix = '>'
    }
    if ( var_delimiter === undefined ) {
        var_delimiter = "::"
    }
    let fdata = '' + source_str
    for ( let key in key_values ) {
        let value = key_values[key]
        if ( value[0] === value_var_prefix ) {
            let varname = value.substr(1)
            let i = vars.indexOf(varname)
            if ( i >= 0 ) {
                value = vars.substring(i + varname.length + var_delimiter.length)  // take in the full variable and including the delimiter, value follows
                if ( value.indexOf(var_delimiter) > 0 ) {  // just clear of the delimiter
                    value = value.substr(0,value.indexOf(var_delimiter))
                }
                value = value.trim()
            }
        }
        fdata = subst(fdata,`$$${key}`,value)
    }
    //
    return fdata
}



module.exports.gsubst = subst
module.exports.array_flatten = array_flatten
module.exports.recursive_flat = recursive_flat
module.exports.find_map = find_map
module.exports.mapify = mapify
module.exports.key_map_sub = key_map_sub
