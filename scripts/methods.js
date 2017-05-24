(function(d) {
    init(); // more magic

    //////////////////////

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
                runGithub(item);
                break;
            case "direct":
                // lel
                break;
        }
    }

    function evaluateStep(step, data) {
        switch(step.type){
            case "extractFile":
                getFileBuffer_zip(data, step.fileExtract, step.newName, step.path);
                break;
            // add more
        }
    }

    // Prepares files and runs each step passing the downloaded files.
    function runGithub(item) {
        getGithubRelease(item, function(err, info) {
            item.steps.forEach(function(step) {
                var asset = getGithubAsset(info.assets, step.file);
                if(asset === null) return;

                getFileBuffer_url(corsURL(asset.browser_download_url), function(data) {
                    evaluateStep(step, data);
                    // stub
                    available = true;
                });
            });
        });
    }

    function getGithubRelease(options, callback) {
        callback = callback || function(){};

        if(rate_limit) {
            callback(new Error("Rate limited lol :p"));
            return;
        }

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

    function getFileBuffer_url(url, callback) {
        console.log("Downloading " + url);
        callback = callback || function(){};

        var ends_zip = url.endsWith('.zip');

        var xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.responseType = "arraybuffer";

        xhr.onload = function () {
            if(this.status !== 200) {
                console.log(this.status);
                // TODO: handle error with callback
                return;
            }

            var fileBlob = new Blob([xhr.response]);
            var fileReader = new FileReader();

            fileReader.onload = function() {
                console.log("Downloaded " + url);
                if(ends_zip){
                    JSZip.loadAsync(this.result).then(function (data) {
                        callback(data);
                    });
                } else {
                    callback(this.result);
                }
            };

            fileReader.readAsArrayBuffer(fileBlob);
        };

        xhr.onerror = function(){item
            console.log(this.status);
            getFileBuffer_url(url,name);
        };

        xhr.send();
    }

    function getFileBuffer_zip(data, originalName, newName, path){
        if(!newName){
            newName = originalName;
        };

        data.file(originalName).async("arraybuffer").then(function(content){
            addFile(content, path, newName);               
        });
    }

    function extractFolder(data, folder, path){    
        var file_count2 = 0;

        Object.keys(data.files).forEach(function(filename){
            var file = data.files[filename];
            if (file.dir || !filename.startsWith(folder)) {
                file_count2++;
                return;
            }
            
            file.async("arraybuffer").then(function(content) {
                file_count2++;
                addFile(content, path, filename);

                if(file_count2 == Object.keys(data.files).length){
                    progress_finish(bufferName, bufferName + ": Added to Zip");
                }
            });
        });
    }

    function extractZip(data, path, removePath){
        //progress(bufferName, bufferName + ": Extracting");
        var fileCount = 0;

        Object.keys(data.files).forEach(function(key){
            var file = data.files[key];
            var filename = file.name;
            if(removePath != ""){
                filename = filename.replace(remove_path + "/", "");
            };

            if (file.dir) {
                fileCount++;
                return;
            }

            file.async("arraybuffer").then(function(content) {
                fileCount++;
                addFile(content, path, filename);
            });             
        });
    }

    // I guess this is not working anymore
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

    function addFile(buffer, path, filename) {
        if(path === ""){
            finalZip.file(filename, buffer);
        } else {
            finalZip.folder(path).file(filename, buffer);
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

    function getGithubAsset(assets, filename) {
        if(assets === null) {
            return null;
        }

        var keys = Object.keys(assets)[0];
        for(var key in keys) {
            if(!keys.hasOwnProperty(key)) {
                continue;
            }

            var asset = assets[key];
            if(asset.name.indexOf(filename) > -1){
                return asset;
            }
        }

        return null;
    }
})(document); // downloader