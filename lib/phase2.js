const fs = require('fs')
const {spawn} = require('child_process')



let g_target = process.argv[2]
let g_choose_template = process.argv[3]
if ( g_target ) {
    console.log(g_target)
    let tfile_name = `./template-configs/${g_target}.json`
    try {
        let jdef = fs.readFileSync(tfile_name,'ascii').toString()
        let tconf = JSON.parse(jdef)
        phase_two_config(tconf,g_target,g_choose_template)
    } catch (e) {
        console.log("CONFIG: " + tfile_name + " does not exists or does not have permissions or is not formatted correctly")
        console.log(e)
    }
} else {
    console.log("no target given on command line")
}


// node genpage.js ${top_level}/${dir}/static/${dir}.subst ../templates/index.html ${top_level}/${dir}/index.html


function phase_two_config(tconf,target,source_template) {

    let top_level = tconf.top_level
    let where_is_subst_file = `${top_level}/${target}/static/${target}.subst`
    //
    let input_template_location = tconf.templates_dir
    let where_is_template_file = `./${input_template_location}/${target}/${source_template}`
    //
    let where_does_output_go = `${top_level}/${target}/staging/${source_template}`

    let where_are_scripts = tconf.scripts_dir
    let generator_program =   `${where_are_scripts}/genpage.js`

    let spawner = spawn("node",[generator_program, where_is_subst_file, where_is_template_file, where_does_output_go])

    spawner.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });
    
    spawner.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });
    
    spawner.on('close', (code) => {
        console.log(`child process exited with code ${code}`);
    });
}
