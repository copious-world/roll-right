
const worker_thread_import_scheme = "importScripts('@bundle_name')"
const main_page_import_scheme = "<script defer src='@bundle_name'></script>"

/**
 * 
 * @param {string} bundle -- name of the file 
 * @param {object} page_or_worker_context 
 */
function bundle_inclusion_transform(bundle,page_or_worker_context) {
    //
    let btxt = ""
    if ( page_or_worker_context._page_type === "worker" ) {
        btxt = worker_thread_import_scheme.replace("@bundle_name",bundle)
    } else {
        btxt = main_page_import_scheme.replace("@bundle_name",bundle)
    }

}


module.exports.bundle_inclusion_transform = bundle_inclusion_transform

