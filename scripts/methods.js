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
            setTimeout(downloadZip, 500);
            return;
        }

        finalZip.generateAsync({ type:"blob" })
        .then(function (blob) {            
            saveAs(blob, "generic_name.zip");
        });
    }

    function startSetup(data) {
        $.get("data/setup.json", function(list) {
            d.querySelectorAll("[data-name]").forEach(function(element) {
                var itemName = element.dataset.name;
                if(itemName && list.hasOwnProperty(itemName)) {
                    evaluateItem(list[itemName]);
                }
            });
        });
    }

    function evaluateItem(item) {
        switch(item.type) {
            case "github":
                getGithubRelease(item, function(err, data) {
                    if(err) {
                        console.error(err);
                        return;
                    }

                    runGithubSteps(data, item.steps);
                });
                break;
        }
    }

    function runGithubSteps(data, steps) {
        steps.forEach(function(step) {
            evaluateStep(step);

            Object.keys(data.assets).forEach(function(key){
                var file = data.assets[key];

                if(file.name.indexOf(step.file) > -1){
                    getFileBuffer_url(corsURL(file.browser_download_url), step);
                    return;
                }
            });
        });
    }

    function evaluateStep(step) {
        switch(step.type){
            case "extractFile":
                console.log("extractFile step");
                getFileBuffer_zip(step.name, step.fileExtract, step.new_name, step.path);
                break;
        }
    }

    function getGithubRelease(options, callback) {
        if(rate_limit) {
            callback(new Error("Rate limited lol"));
            return;
        }

        callback = callback || function(){};
        var defaults = {
            author: "",
            repo: "",
            version: "latest"
        };

        options = $.extend(defaults, options);
        if(!options.author || !options.repo) {
            callback(new Error("Author and repo names required"), null);
            return;
        }

        var url = "https://api.github.com/repos/" + options.author + "/" + options.repo + "/releases";
        if(options.version === "latest") {
            url += "/latest";
        } else if(options.version !== "") {
            url += "/tags/" + options.version;
        }

        $.getJSON(url, function(data) {
            if(options.version === "") {
                data = data[0];
            }

            callback(null, data);
        }).fail(function(jqXHR) {
            rateLimit(jqXHR);
        });
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
            //var reset = Date(data.rate.reset * 1000);
            rate_limit = data.rate.remaining === 0;
        });
    }

    function corsURL(url) {
        return "https://cors-anywhere.herokuapp.com/" + url;
    }
})(document); // downloader