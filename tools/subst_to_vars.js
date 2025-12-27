





const fs = require('fs')


function pull_out_keys_deep(conf,prefix = "") {
    let keys = Object.keys(conf)
    let pulled_kys = []
    for ( let key of keys ) {
        let ky_data = conf[key]
        if ( typeof ky_data === 'string' ) {
            pulled_kys.push(key)
        } else if ( typeof ky_data === 'object' ) {
            let subkys = pull_out_keys_deep(ky_data,key)
            pulled_kys = pulled_kys.concat(subkys)
        }
    }
    if ( prefix.length > 0 ) {
        let final_keys = pulled_kys.map((ky) => { return `${prefix}.${ky}`})
        return final_keys
    } else {
        return pulled_kys
    }
}


let input_file_name = process.argv[2]

if ( !input_file_name ) {
    console.log("you need to pass a subst file name as a parameter")
    process.exit(0)
}


let conf_str = fs.readFileSync(input_file_name)
try {
    let conf = JSON.parse(conf_str)
    if ( typeof conf === "object" ) {
        let conf_as_array = pull_out_keys_deep(conf)
        console.log(JSON.stringify(conf_as_array,null,4))
    }
} catch (e) {
    console.log(e)
}