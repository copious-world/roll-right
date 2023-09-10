#!/usr/bin/env node

const {FileOperations} = require('extra-file-class')


let fosc = new FileOperations(false)

async function process_file(file_name,deposit_dir) {
    let is_file = await fosc.exists(file_name)
    if ( is_file ) {
        if ( await fosc.ensure_directories(deposit_dir) ) {
            let file_txt = await fosc.load_data_at_path(file_name)
            if ( file_txt ) {
                let parts = file_txt.split('// ---->>>')
                console.log(`# of parts: ${parts.length}`)
                if ( parts.length > 0 ) {
                    parts.pop()
                    let count = 0
                    let ext = ".html"
                    for ( let part of parts ) {
                        count++
                        await fosc.output_string(`${deposit_dir}/part_${count}.${ext}`,parts[count-1])
                        ext = "js"
                    }
                }
            } else {
                console.log(`Could not read ${file_name}`)
            }
        }
    } else {
        console.log(`can't find file ${file_name}`)
    }
}


let deposit_dir = "rr-breakup"
let holding_dir = process.argv[3]
if ( holding_dir !== undefined  ) {
    if ( holding_dir[holding_dir.length-1] !== '/' ) {
        holding_dir += '/'
    }
    deposit_dir = holding_dir + deposit_dir
}


let file = process.argv[2]
//
if ( file === undefined ) {
    console.log("roll-right-breakup is expecting at least one command line parameter: name of file to be processed")
} else {
    console.log(file)
    process_file(file,deposit_dir)    
}


