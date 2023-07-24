var app = angular.module("listApp", ["ngAnimate", "ngRoute", "ngSanitize"]);
//check if dev or prod
var MY_EVIRONMENT = "";
if (document.location.hostname == 'cheapchariots.local') {
    MY_EVIRONMENT = "dev";
} else {
    MY_EVIRONMENT = "prod";
}

app.filter('orderObjectBy', function() {
    return function(items, field, reverse) {
        var filtered = [];
        angular.forEach(items, function(item) {
            filtered.push(item);
        });
        filtered.sort(function (a, b) {
            return (a[field] > b[field] ? 1 : -1);
        });
        if(reverse) filtered.reverse();
        return filtered;
    };
});

app.controller('listController', function($scope, $http, $route) {
    $scope.gStatus = "this is working.";
    //console.log(MY_EVIRONMENT);

    var myServername = "http://admin.cheapchariots.com";
    if (MY_EVIRONMENT == "dev") {
        myServername = "http://admin.cheapchariots.local";
    }

    var request = $http({
        method: "get",
        url: myServername + "/json/allcars/",
        //data: $scope.date,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    $scope.updatemake = function() {
        console.log($scope.filters.make);
    }
    $scope.filters = {};

    var myTmpType = $.urlParam('type');
    var myTmpColor = $.urlParam('color');
    var myTmpPrice = $.urlParam('pricerange');

    $scope.filters.type = (myTmpType) ? myTmpType : "All";
    $scope.filters.color = (myTmpColor) ? myTmpColor : 'All';
    $scope.filters.pricerange = (myTmpPrice) ? myTmpPrice : "All";
    $scope.filters.make = 'All';

    /* Check whether the HTTP Request is successful or not. */
    request.then(function (data) {
        //success
        $scope.allcars = data.data;
        console.log(data.data);


        $scope.allmakes = {};
        $scope.allcolors = {};


        $scope.allmakes['All'] = "All";
        $scope.allcolors['All'] = "All";

        angular.forEach($scope.allcars,function(value,key){
            //make a list of all the car makes in the list.
            var myMake = value.field_make['und'][0]['value'];
            var myColor = value.field_color['und'][0]['value'];
            $scope.allmakes[myMake] = myMake;
            $scope.allcolors[myColor] = myColor;
            //console.log($scope.allmakes);
        });
    },function(data){
        //error
        // console.log(data);
    });

});

// HELPER FUNCTIONS
$.urlParam = function(name){
    var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
    if (results==null){
       return null;
    }
    else{
       return results[1] || 0;
    }
}
