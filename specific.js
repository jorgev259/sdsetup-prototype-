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
            getLatestRelease(step.author,step.repo,step.file,step_name);
            evaluate_step(step.step,step,step_name);
            break;
    }
}