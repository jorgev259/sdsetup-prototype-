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
    console.log(JSON.parse(data));
    var list = $("#whatyouneed").children();
    console.log(list);
    console.log(list[0].dataset);
}