
app.controller('GitController', ['$scope', function ($scope) {
  $scope.saving = false;
  $scope.save = function () {
    $scope.saving = true;
    $.ajax({
      url: 'api/git/config',
      type: 'PUT',
      data: $scope.config,
      dataType: 'json',
      success: function(data, ts, xhr) {
        $scope.success(data.message);
        $scope.saving = false;
        $scope.config = data.config;
        $scope.$root.$digest();
      },
      error: function(xhr, ts, e) {
        $scope.saving = false;
        if (xhr && xhr.responseText) {
          var data = $.parseJSON(xhr.responseText);
          $scope.error("Error saving config: " + data.errors[0]);
        } else {
          $scope.error("Error saving config: " + e);
        }
        $scope.$root.$digest();
      }
    });
  };
}]);
