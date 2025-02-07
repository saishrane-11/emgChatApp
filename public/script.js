const socket = io();
let currentUser = "";
let selectedUser = "";

// window.onload = function () {
//     if (localStorage.getItem("isValidUser") === "true") {
//         let username = localStorage.getItem("isValidUserName")

//         socket.emit("user-online", username);
//         loadUserList();
//         document.getElementById("authSection").style.display = "none";
//         document.getElementById("chatSection").style.display = "flex";
//     }
    
// };
// Register user

function register() {
    let username = document.getElementById("regUsername").value;
    let password = document.getElementById("regPassword").value;
    let phone=document.getElementById('regPhone').value;
    let email=document.getElementById('regEmail').value;
    let latitude = ""
    let longitude = ""
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            latitude = position.coords.latitude;
            longitude = position.coords.longitude;
            fetch("/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password, latitude, longitude,phone,email })
            }).then(res => res.json())
                .then(data => {


                   
                        alert(data.message);
                        localStorage.setItem("isValidUser", "true");
                        localStorage.setItem("isValidUserName", username);
                    
                   
                    loadUserList();
                });
        })
    };

}
// Function to fetch user details by username
async function fetchUser(username) {
    try {
      // Fetch the list of users from the API
      const response = await fetch("/get-users");
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
  
      // Parse the response as JSON
      const users = await response.json();
    //   console.log("Fetched users:", users);
  
      // Find the user with the matching username
      const userDetails = users.find((user) => user.username === username);
      console.log(userDetails)
      if (userDetails) {
        return userDetails; // Return the user details
      } else {
        throw new Error("User not found");
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      throw error; // Re-throw the error to handle it outside
    }
  }
async function fetchUserRole(username) {
    let role = "";

    try {
        const response = await fetch("/get-users");
        const users = await response.json();
        console.log(users);

        const userDetails = getUserByUsername(users, username); // Assuming `username` is defined
        role = userDetails.role;
        console.log(role); // Accessible here
    } catch (error) {
        console.error("Error fetching users:", error);
    }

    return role; // Return the role for use outside the function
}

// Usage
// (async () => {
//     const username = "rohit"; // Replace with the username you want to search for
//     const role = await fetchUserRole(username);
//     console.log("Role outside fetch:", role); // Accessible here
// })();

// Login user
function login() {
    let username = document.getElementById("loginUsername").value;
    let password = document.getElementById("loginPassword").value;

    fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    }).then(res => res.json())
        .then(data => {
            if (data.message === "Login successful") {
                //step of verification can be added if email not verified
               console.log("here")
                currentUser = username;
                localStorage.setItem("isValidUser", "true");
                localStorage.setItem("isValidUserName", username);
                document.getElementById("authSection").style.display = "none";
                document.getElementById("chatSection").style.display = "flex";
                socket.emit("user-online", username);

                

                (async () => {
                    
                  
                    try {
                        let role = await fetchUserRole(username);
                      console.log("Role fetched:", role);
                      if (role != 'user') {
                        console.log("police ka set")
                        loadUserListForService();
                    } else {
                        loadUserList();
                    }
                      // Now you can proceed with the rest of your code
                      console.log("Proceeding with the role:", role);
                      // Add your logic here that depends on the role
                    } catch (error) {
                      console.error("Failed to fetch role:", error);
                    }
                  })();
                  

            
             

            } else {
                alert(data.message);
            }
        });
}
function loadUserListForService() {
    console.log("In loaduserLIst for serve")
    fetch("/get-users")
        .then(res => res.json())
        .then(users => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((position) => {
                    currentLatitude = position.coords.latitude;
                    currentLongitude = position.coords.longitude;

                   
                    let userList = document.getElementById("userList");


                    userList.innerHTML = "";
                    
                    console.log('this is the main',users)

                    users.forEach(user => {
                        console.log("hello how are you")
                        console.log(user)
                        if (user.username !== currentUser && user.role == 'user') {


                            let li = document.createElement("li");
                            li.textContent = user.username;
                            li.onclick = () => {
                                selectedUser = user.username;
                                document.getElementById("chatHeader").innerText = `Chat with ${user.username}`;
                                document.getElementById("chatBox").innerHTML = "";
                                loadChatHistory(user.username);
                            };
                            userList.appendChild(li);
                        }
                    });
                })
            }

        });
}
// Function to fetch user details by username
function getUserByUsername(users, username) {
    return users.find((user) => user.username === username);
}


// Function to calculate the distance between two sets of coordinates using Haversine formula
const haversineDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
};

// Function to find the closest user for each role
const getClosestUsers = (currentLatitude, currentLongitude, users) => {
    const roles = {};

    // Group users by role (excluding 'user' role)
    users.forEach(user => {
        if (user.role !== 'user') {
            if (!roles[user.role]) {
                roles[user.role] = [];
            }
            roles[user.role].push(user);
        }
    });

    // Find the closest user for each role
    const closestUsers = [];
    Object.keys(roles).forEach(role => {
        let closestUser = null;
        let minDistance = Infinity;

        roles[role].forEach(user => {
            const distance = haversineDistance(currentLatitude, currentLongitude, user.latitude, user.longitude);
            if (distance < minDistance) {
                minDistance = distance;
                closestUser = user;
            }
        });

        if (closestUser) {
            closestUsers.push(closestUser);
        }
    });

    return closestUsers;
};


// Fetch and display all users
function loadUserList() {
    fetch("/get-users")
        .then(res => res.json())
        .then(users => {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((position) => {
                    currentLatitude = position.coords.latitude;
                    currentLongitude = position.coords.longitude;

                    const closestUsers = getClosestUsers(currentLatitude, currentLongitude, users);
                    let userList = document.getElementById("userList");


                    userList.innerHTML = "";
                    console.log("000000000000000000000000")
                    console.log(users)
                    console.log("000000000000000000000000")
                    console.log(closestUsers)


                    closestUsers.forEach(user => {
                        console.log("hello how are you")
                        console.log(user)
                        if (user.username !== currentUser && user.role != 'user') {


                            let li = document.createElement("li");
                            li.textContent = user.username;
                            li.onclick = () => {
                                selectedUser = user.username;
                                document.getElementById("chatHeader").innerText = `Chat with ${user.username}`;
                                document.getElementById("chatBox").innerHTML = "";
                                loadChatHistory(user.username);
                            };
                            userList.appendChild(li);
                        }
                    });
                })
            }

        });
}

// Load chat history
function loadChatHistory(user) {
    fetch("/get-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user1: currentUser, user2: user })
    })
        .then(res => res.json())
        .then(messages => {
            let chatBox = document.getElementById("chatBox");
            chatBox.innerHTML = "";
            messages.forEach(msg => {
                chatBox.innerHTML += `<b>${msg.sender}:</b> ${msg.message}<br>`;
            });
            chatBox.scrollTop = chatBox.scrollHeight;
        });
}

// Receive messages
socket.on("receive-message", ({ sender, receiver, message }) => {
    if (receiver === currentUser || sender === currentUser) {
        let chatBox = document.getElementById("chatBox");
        chatBox.innerHTML += `<b>${sender}:</b> ${message}<br>`;
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});

// Send message
function sendMessage() {
    let messageInput = document.getElementById("messageInput");
    let message = messageInput.value.trim();
    if (message && selectedUser) {
        socket.emit("send-message", { sender: currentUser, receiver: selectedUser, message });
        messageInput.value = "";
    } else {
        alert("Select a user to chat with!");
    }
}
function makeACall(){
    if (!selectedUser) {
        alert("Select a user to send location!");
        return;
    }
    // console.log(selectedUser)
    
    (async () => {
                    
                  
        try {
            let cuser=await fetchUser(selectedUser);
            console.log(cuser)
            console.log(cuser.phone)
            if (cuser.phone) {
                window.location.href = `tel:${cuser.phone}`; // Opens dialer with number
            } else {
                alert('Contact not found');
            }
        } catch (error) {
          console.error("Failed to fetch cuser:", error);
        }
      })();
   
   
}
// Send user's location dynamically
function sendLocation() {
    if (!selectedUser) {
        alert("Select a user to send location!");
        return;
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const locationMessage = `📍 <a href="https://www.google.com/maps?q=${latitude},${longitude}" target="_blank">My Location</a>`;

            socket.emit("send-message", { sender: currentUser, receiver: selectedUser, message: locationMessage });
        }, () => {
            alert("Failed to get location. Please allow location access.");
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}