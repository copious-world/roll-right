const fs = require('fs')
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