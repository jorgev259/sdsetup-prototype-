$(document).ready(function(){
    $.get("./setup_steps",function (data){start_setup(data);});
})

function start_setup(data){
    var list = JSON.parse(data);
    var element_list = $("#whatyouneed").children();
    
    for(var i=0;i<element_list.length;i++){
        var step_name = $(element_list[i]).data().name;      
        var step = list[step_name];
        
        evaluate_step(step.type,step,step_name);
    }
}

function evaluate_step(step,step_data,step_name){
    switch(step){
        case "latest":
            getLatestRelease(step_data.author,step_data.repo,step_data.file,step_name);
            evaluate_step(step_data.step,step_data,step_name);
            break;
            
        case "extractFile":                     
            getFileBuffer_zip(step_name,step_data.fileExtract,step_data.new_name,step_data.path);
            break;
    }
}

/*"SafeB9SInstaller_payload":{
        "repo":"SafeB9SInstaller",
        "author":"d0k3",
        "type":"latest",
        "step":"extractFile",
        "file":".zip",
        "fileExtract":"SafeB9SInstaller.bin",
        "new_name":"start_SafeB9SInstaller.bin",
        "path":"luma/payloads"
    },*/