#!/usr/bin/env node




const papa = require('../index.js')

console.log(__filename)
console.log(process.argv[0])
console.log(process.argv[1])


papa.identify_me()

let output = papa.browser_code()
for ( let fcontent of output ) {
    let {file_path, content} = fcontent
    console.log(file_path)
    console.log("---------------------------")
    console.log(content)
}
