(function(d) {
    init(); // more magic

    //////////////////////

    var finalZip = new JSZip();
    var rateLimit = null;
    var rateLimited = false;
    var totalSteps = 0;
    var finishedSteps = 0;

    function init() {
        startSetup();
        loadRateLimit();
        $('.dl-button').click(function() {
            downloadZip();
        });
    }

    function downloadZip() {
        if(!totalSteps > 0 && finishedSteps >= totalSteps) {
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
                    totalSteps += list[itemName].steps.length;
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
                runDirect(item);
                break;
        }
    }

    function evaluateStep(step, data) {
        switch(step.type){
            case "extractFile":
                if(step.fileExtract) {
                    getFileBuffer_zip(data, step.fileExtract, step.path);
                } else if(step.files) {
                    step.files.forEach(function(fileStep) {
                        getFileBuffer_zip(data, fileStep.file, fileStep.path);
                    });
                } else {
                    extractZip(data, step.path, step.remove_path);
                }
                break;
                
            case "addFile":
                addFile(data, step.path, step.file);
                break;
                
            case "deleteFile":
                if(step.file) {
                    deletefile_zip(data,step.file);
                } else if(step.files) {
                    step.files.forEach(function(fileStep) {
                        deletefile_zip(data, fileStep.file);
                    });
                }

                break;
                
            case "folder":
                folder(step.name);
                break;
            // add more
        }

        finishedSteps++; // kinda
        if(totalSteps === finishedSteps) {
            $('.dl-button').text("Download");
        }
    }

    // Prepares files and runs each step passing the downloaded files.
    function runGithub(item) {
        getGithubRelease(item, function(err, info) {
            item.steps.forEach(function(step) {
                var asset = getGithubAsset(info.assets, step.file);
                if(asset === null) {
                    console.log("no asset found for " + step.file);
                    return;
                }

                getFileBuffer_url(corsURL(asset.browser_download_url), function(data) {
                    evaluateStep(step, data);
                });
            });
        });
    }
    
    function runDirect(item) {
        getFileBuffer_url(corsURL(item.url), function(data) {
            item.steps.forEach(function(step) {
                evaluateStep(step, data);
            });
        });
    }

    function getGithubRelease(options, callback) {
        callback = callback || function(){};

        if(rateLimited) {
            callback(new Error("Rate limited lol :p"));
            return;
        }

        var defaults = {
            repo: "",
            version: "latest"
        };

        options = $.extend(defaults, options);
        if(!options.repo) {
            callback(new Error("Repo name is required"), null);
            return;
        }

        var url = "https://api.github.com/repos/" + options.repo + "/releases";
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
            //rateLimit(jqXHR);
        });
    }

    function getFileBuffer_url(url, callback) {
        console.log("Downloading " + url);
        callback = callback || function(){};

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
                if(url.endsWith('.zip')){
                    JSZip.loadAsync(this.result).then(function (data) {
                        callback(data);
                    });
                } else {
                    callback(this.result);
                }
            };

            fileReader.readAsArrayBuffer(fileBlob);
        };

        xhr.onerror = function(){
            console.log(this.status);
            getFileBuffer_url(url,name);
        };

        xhr.send();
    }

    function getFileBuffer_zip(data, originalName, path, newName){
        newName = newName || originalName;

        try {
            data.file(originalName).async("arraybuffer").then(function(content){
                addFile(content, path, newName);               
            });
        } catch(e) {
            console.log("Could not get " + originalName + " from some zip file");
            console.log(data);
        }
        
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
                filename = filename.replace(removePath + "/", "");
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

    function addFile(buffer, path, filename) {
        if(path === ""){
            finalZip.file(filename, buffer);
        } else {
            finalZip.folder(path).file(filename, buffer);
        }
    }
    
    function deletefile_zip(data, filename){
        data.remove(filename);
    }

    function folder(name){
        finalZip.file(name + "/dummy.txt", "i love ice cream");
        finalZip.remove(name + "/dummy.txt");
    }

    function loadRateLimit() {        
        $.getJSON("https://api.github.com/rate_limit", function(data){
            rateLimit = data.resources.core;
            updateRateLimit(true);
            setTimeout(loadRateLimit, 20000);
        });
    }

    function updateRateLimit(noTimeout) {
        if(typeof noTimeout === "undefined") {
            noTimeout = false;
        }
        
        if(!rateLimit) {
            loadRateLimit();
            return;
        }

        var reset = (new Date(rateLimit.reset * 1000));
        var now = (new Date()) * 1;
        var delta = Math.floor((reset - now) / 1000);
        $('#rl').text("Rate limit: " + delta + " seconds until reset. ")
            .append(rateLimit.remaining + "/" + rateLimit.limit + " remaining");

        rateLimited = rateLimit.remaining === 0;
        if(delta <= 0) {
            loadRateLimit();
        }
        
        if(!noTimeout) {
            setTimeout(updateRateLimit, 500);
        }
    }

    function corsURL(url) {
        return "https://cors-anywhere.herokuapp.com/" + url;
    }

    function getGithubAsset(assets, filename) {
        if(assets === null) {
            return null;
        }

        var keys = Object.keys(assets);
        for(var key in keys) {
            if(!keys.hasOwnProperty(key)) continue;

            var asset = assets[key];
            if(asset.name.indexOf(filename) > -1 || asset.name === filename){
                return asset;
            }
        }

        return null;
    }
})(document);