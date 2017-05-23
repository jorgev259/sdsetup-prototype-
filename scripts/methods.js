(function(d) {
    init(); // more magic

    //////////////////////

    var bufferList = {};
    var delete_zip = {};
    var finalZip = new JSZip();
    var available = false;
    var rate_limit = false;
    var waiting = false;

    function init() {
        startSetup();
        $('.dl-button').click(function() {
            if(!waiting) {
                downloadZip();
                waiting = true;
            }
        });
    }

    function downloadZip() {
        if(!available) {
            setTimeout(downloadZip(), 500);
            return;
        }

        finalZip.generateAsync({ type:"blob" })
        .then(function (blob) {            
            saveAs(blob, "generic_name.zip");
        });
    }

    function startSetup(data) {
        $.get("data/setup_steps.json", function(list) {
            d.querySelectorAll("[data-name]").forEach(function(element) {
                console.log(element);
                var stepName = element.dataset.name;
                if(stepName && list.hasOwnProperty(stepName)) {
                    var step = list[stepName];
                    evaluateStep(step.type, step, stepName);
                }
            });
        });
    }

    function evaluateStep(step, step_data, step_name) {
        switch(step){
            case "latest":
                getLatestRelease(step_data.author, step_data.repo, step_data.file, step_name);
                evaluateStep(step_data.step, step_data, step_name);
                break;
                
            case "extractFile":                     
                getFileBuffer_zip(step_name, step_data.fileExtract, step_data.new_name, step_data.path);
                break;
        }
    }

    function getFileBuffer_url(url, name) {
        console.log("Downloading " + url);
        available = false;

        var ends_zip = url.endsWith('.zip');

        var xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.responseType = "arraybuffer";

        xhr.onload = function () {
            if(this.status !== 200) {
                console.log(this.status);
                return;
            }

            var fileBlob = new Blob([xhr.response]);
            var fileReader = new FileReader();

            fileReader.onload = function() {
                if(ends_zip){
                    JSZip.loadAsync(this.result).then(function (data) {
                        bufferList[name] = data;
                    });
                } else {
                    bufferList[name] = this.result;
                }
            };
            fileReader.readAsArrayBuffer(fileBlob);
            available = true;
        };

        xhr.onerror = function(){
            console.log(this.status);
            getFileBuffer_url(url,name);
        };

        xhr.send();
    }

    // TODO: Merge github methods

    // TODO: receive an object as argument
    function getLatestRelease(author, repo, filename, step){
        if(rate_limit) return;

        $.getJSON("https://api.github.com/repos/" + author + "/" + repo + "/releases/latest", function( data ) {
            Object.keys(data.assets).forEach(function(key){
                var file = data.assets[key];

                if(file.name.indexOf(filename) > -1){
                    getFileBuffer_url(corsURL(file.browser_download_url), step);
                    return;
                }
            })
        }).fail(function(jqXHR) {
            rateLimit(jqXHR);
        });
    }

    // TODO: receive an object as argument
    function getRelease(author, repo, filename, release, step) {
        if(rate_limit) return;
        
        $.getJSON("https://api.github.com/repos/" + author + "/" + repo + "/releases/tags/" + release, function( data ) {
            Object.keys(data.assets).forEach(function(key){
                var file = data.assets[key];

                if(file.name.indexOf(filename) > -1){
                    getFileBuffer_url(corsURL(file.browser_download_url), step);
                    return;
                }
            })
        }).fail(function(jqXHR) {
            rateLimit(jqXHR);
        });
    }

    // TODO: receive an object as argument
    function notLatestRelease(author, repo, filename, step){
        if(rate_limit) return;

        $.getJSON("https://api.github.com/repos/" + author + "/" + repo + "/releases", function( data ) {
        var data = data[0];  Object.keys(data.assets).forEach(function(key){
                var file = data.assets[key];

                if(file.name.indexOf(filename) > -1){
                    getFileBuffer_url(corsURL(file.browser_download_url), step);
                }
            })
        }).fail(function(jqXHR) {
            rateLimit(jqXHR);
        });
    }

    // TODO: receive an object as argument
    function getFileBuffer_zip(bufferName, original_name, new_name, path){    
        if(bufferList[bufferName] == undefined){        
            setTimeout(function(){ getFileBuffer_zip(bufferName,original_name,new_name,path)},500);
        } else {
            if(new_name == undefined || new_name == ""){new_name = original_name};
            var data =  bufferList[bufferName]    
                data.file(original_name).async("arraybuffer").then(function success(content){
                    addFile(content,path,new_name,"buffer");               
                })                                
        }
    }

    function extractFolder(bufferName, folder, path){    
        if(bufferList[bufferName] == undefined){      
            setTimeout(function(){ extractFolder(bufferName,folder,path)},500);
            return;
        }

        var data =  bufferList[bufferName]
        var file_count2 = 0;
        
        //Modified from @jkcgs's snippet from extractZip :3
        Object.keys(data.files).forEach(function(filename){
            var file = data.files[filename];
            if (file.dir || !filename.startsWith(folder)) {
                file_count2++;
                return;
            }
            
            file.async("arraybuffer").then(function(content) {
                file_count2++;
                addFile(content, path, filename, "buffer");

                if(file_count2 == Object.keys(data.files).length){
                    progress_finish(bufferName, bufferName + ": Added to Zip");
                    
                }
                
            });
        });
    }

    function extractZip(bufferName, path, remove_path){
        if(bufferList[bufferName] == undefined || delete_zip[bufferName] == true) {
            setTimeout(function(){ 
                extractZip(bufferName,path,remove_path);
            }, 500);
            return;
        }

        var data = bufferList[bufferName]
        progress(bufferName, bufferName + ": Extracting");
        var file_count = 0;
            
        //Code snippet from @jkcgs :3
        Object.keys(data.files).forEach(function(key){
            var file = data.files[key];
            var file_name = file.name;
            if(remove_path != ""){var file_name = (file_name).replace(remove_path + "/","");};
            if (file.dir) {
                file_count++;
                return;
            }

            file.async("arraybuffer").then(function(content) {
                file_count++;
                addFile(content, path, file_name, "buffer");
            });             
        });
    }

    function deletefile_zip(bufferName, filename){
        delete_zip[bufferName] = true;
        if(bufferList[bufferName] == undefined){
            setTimeout(function(){ 
                deletefile_zip(bufferName,filename)
            }, 500);
        } else {  
            bufferList[bufferName].remove(filename);       
            delete_zip[bufferName] = false;
        }
    }

    function addFile(name, path, filename, origin){
        //origin either "list" or "buffer"
        
        var buffer;
        switch(origin){
            case "list":
                buffer = bufferList[name];
                break;
            case "buffer":
                buffer = name;
                break;
        }
        
        if(buffer == undefined){        
            setTimeout(function(){ addFile(name,path,filename,origin);},500);
        } else {                
            if(path == ""){
                finalZip.file(filename,buffer);
            } else {
                finalZip.folder(path).file(filename,buffer);
            }
        }
    }

    function folder(name){
        finalZip.file(name + "/dummy.txt", "i love ice cream");
        finalZip.remove(name + "/dummy.txt");
    }

    function rateLimit(jresult) {
        if (jresult.status !== 403) {
            return;
        }
        
        $.getJSON("http://api.github.com/rate_limit", function(data){
            var reset = Date(data.rate.reset * 1000);
            if(!rate_limit){
                rate_limit = true;
            }
        });
    }

    function corsURL(url) {
        return "https://cors-anywhere.herokuapp.com/" + url;
    }
})(document); // downloader