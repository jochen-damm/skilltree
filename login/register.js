function validate() {
	var loginBox = document.getElementById("loginBox");
	var username = document.getElementById("username");
	var password1 = document.getElementById("password1");
	var password2 = document.getElementById("password2");
	var email = document.getElementById("email");

	if(password1.value == password2.value){
		var httpRequest = new XMLHttpRequest();
		var params = 'username=' + username.value + '&password=' + password1.value + '&email=' + email.value;

		httpRequest.open('POST', '/registration', true);
		httpRequest.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
		httpRequest.responseType = "json";

		httpRequest.onreadystatechange = function() {
		    if(httpRequest.readyState == 4 && httpRequest.status == 200) {
					loginBox.style.display = "none";
					if(httpRequest.response.success){
						//showToast();
						window.open("/", "_self");
					}
		    }
		}
		httpRequest.send(params);
	}
	else{
		alert("Incorrect credentials! Passwords don't match!");
	}
}

function showToast() {
	var toast = document.getElementById("toast");

	toast.className = "show";

	setTimeout(function(){
		toast.className = ""
	}, 3000);
}
