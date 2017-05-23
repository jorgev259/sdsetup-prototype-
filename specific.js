$(document).ready(function(){
    $.ajax({
        url: "./setup_steps",
        async: false,
        success: function (data){
            start_setup(data);
        }
    });  
})

function start_setup(data){
    var list = JSON.parse(data);
    var element_list = $("#whatyouneed").children();
    
    for(var i=0;i<element_list.length;i++){
        var step_name = $(element_list[i]).data().name;      
        var step = list[step_name];
        
        switch(step.type){
            case "latest":
                getLatestRelease(step.author,step.repo,step.file,step_name);
                break;
        }
    }
}