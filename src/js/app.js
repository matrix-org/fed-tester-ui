'use strict';

const React = require('react');
const ReactDOM = require('react-dom');
const Linkify = require('react-linkify').default;
const Promise = require('bluebird');
const rfetch = require('fetch-retry');

require('../scss/layout.scss');

let uniq = require('arr-uniq');
let defaultValue = require('default-value');
let create = require('create-react-class');
let urllib = require('url');
let debounce = require('debounce');

let options = {retries: 5, retryDelay: 200};

//let persistLocalStorage = require('./lib/persist-local-storage');

// Components
let File = require('./components/fileUpload');
let RoomList = require('./components/roomList');
let Event = require('./components/Events.js');

let neo = require('../assets/neo_full.png');
let blank = require('../assets/blank.jpg');
let loadingGif = require('../assets/loading.gif');

let VERSION = "alpha0.03-dev6";

let icon = {
  file: {
    dark: require('../assets/dark/file.svg'),
    light: require('../assets/light/file.svg')
  },
  send: {
    dark: require('../assets/dark/send.svg'),
    light: require('../assets/light/send.svg')
  },
  hamburger: {
    dark: require('../assets/dark/hamburger.svg')
  }
};

let App = create({
  displayName: "App",
  getInitialState: function() {
    let user = {};
    let userinfo = {};
    let rooms = {};
    let messages = {};
    let invites = {};
    if(localStorage.getItem("version") == VERSION && localStorage.getItem("logout") != "true") {
      user = JSON.parse(localStorage.getItem("user"));
      userinfo = JSON.parse(localStorage.getItem("userinfo"));
      invites = JSON.parse(localStorage.getItem("invites"));
      console.log("loaded user data from storage");
    }
    return({
      user: user,
      userinfo: userinfo,
      unsentMessages: {},
      rooms: rooms,
      invites: invites,
      handledInvites: {},
      messages: messages,
      loading: 0,
      room: 0,
      backlog: 0
    });
  },

  componentDidMount: function() {
    if (this.state.user.access_token != undefined) {
      this.initialSync();
    }
  },

  loginCallback: function(json) {
    json.hs = urllib.parse("https://" + json.home_server);
    this.get_userinfo(json.user_id, json);
    json.username = json.user_id.split(':')[0].substr(1);
    json.settings = {
      bool: {
        split: false,
        bubbles: false
      },
      input: {
        highlights: ""
      }
    };
    localStorage.setItem("version", VERSION);
    localStorage.setItem("logout", "false");
    localStorage.setItem("user", JSON.stringify(json));
    localStorage.setItem("invites", "{}");
    this.setState({
      user: json,
    });
    this.initialSync();
  },

  get_userinfo: function(id, user) {
    let userState = this.state.user;
    if (user != undefined) {
      userState = user;
    }
    let userinfo = this.state.userinfo;
    userinfo[id] = {display_name: id, img: blank};
    this.setState({userinfo: userinfo});

    let url = urllib.format(Object.assign({}, userState.hs, {
      pathname: `/_matrix/client/r0/profile/${id}/displayname`,
      query: {
        access_token: userState.access_token
      }
    }));

    this.nameFetch = rfetch(url, options)
      .then(response => response.json())
      .then(responseJson => {
        if (responseJson.displayname != undefined) {
          userinfo = this.state.userinfo;
          userinfo[id].display_name = responseJson.displayname;
          this.setState({userinfo: userinfo});
          localStorage.setItem("userinfo", JSON.stringify(this.state.userinfo));
        }
      });

    url = urllib.format(Object.assign({}, userState.hs, {
      pathname: `/_matrix/client/r0/profile/${id}/avatar_url`,
      query: {
        access_token: userState.access_token
      }
    }));

    this.imgFetch = rfetch(url, options)
      .then(response => response.json())
      .then(responseJson => {
        if(responseJson.errcode == undefined &&
          responseJson.avatar_url != undefined) {
          userinfo = this.state.userinfo;
          userinfo[id].img = m_thumbnail(userState.hs, responseJson.avatar_url, 64, 64);
          this.setState({userinfo: userinfo});
          localStorage.setItem("userinfo", JSON.stringify(this.state.userinfo));
        }
      });
  },

  setStateFromChild: function(prop, value) {
    this.setState({
      [prop]: value
    });
  },

  logout: function() {
    localStorage.removeItem("user");
    this.setState({
      user: {},
      logout: true
    });
  },

  initialSync: function() {
    let url = urllib.format(Object.assign({}, this.state.user.hs, {
      pathname: "/_matrix/client/r0/joined_rooms",
      query: {
        access_token: this.state.user.access_token
      }
    }));

    rfetch(url, options)
      .then((response) => response.json())
      .catch((error) => {
        console.error('Error:', error);
        this.initialSync(); //retry
      })
      .then((responseJson) => {
        Promise.map(responseJson.joined_rooms, (roomId) => {
          // Get backlog
          url = urllib.format(Object.assign({}, this.state.user.hs, {
            pathname: `/_matrix/client/r0/rooms/${roomId}/messages`,
            query: {
              limit: 80,
              dir: "b",
              access_token: this.state.user.access_token
            }
          }));

          return rfetch(url, options)
            .then((response) => response.json())
            .then((responseJson) => {
              return this.backlog(roomId, responseJson);
            });
        }).then(() => {
          console.log("neo: done getting all backlog/userlists");
          this.sync();
        });
      });
  },

  backlog: function(roomId, responseJson) {
    let messages = this.state.messages;
    let localRooms = this.state.rooms;
    let remoteRoom = responseJson.chunk;

    let combinedMessages = this.addMessages(roomId, remoteRoom);
    messages[roomId] = combinedMessages;

    messages[roomId] = combinedMessages;

    function findLast(array, predicate) {
      return array.slice().reverse().find(predicate);
    }

    if (localRooms[roomId] == null) {
      localRooms[roomId] = {};
    }

    localRooms[roomId].lastMessage = findLast(combinedMessages, (message) => {
      return (message.content.body != null);
    });

    localRooms[roomId].lastMessage = defaultValue(
      localRooms[roomId].lastMessage,
      combinedMessages[combinedMessages.length - 1]
    );

    if (localRooms[roomId].lastMessage == undefined) {
      console.log(responseJson, roomId);
      localRooms[roomId].lastMessage = {
        origin_server_ts: 0,
        content: {
          body: ""
        }
      };
    }

    localRooms[roomId].notif = {unread: 0, highlight: 0};
    return this.userList(roomId, localRooms, messages);
  },

  userList: function(roomId, localRooms, messages) {
    //Thanks git merge for breaking this
    //get Userlist
    let url = urllib.format(Object.assign({}, this.state.user.hs, {
      pathname: `/_matrix/client/r0/rooms/${roomId}/joined_members`,
      query: {
        access_token: this.state.user.access_token
      }
    }));

    return rfetch(url, options)
      .then((response) => response.json())
      .then((responseJson) => {
        let remoteUsers = responseJson.joined;

        Object.keys(remoteUsers).forEach((userId) => { //Really slow
          let remoteUser = remoteUsers[userId];
          if (remoteUser.display_name == undefined) {
            remoteUser.display_name = userId;
          }
          if (remoteUser.avatar_url == undefined) {
            remoteUser.img = blank;
          } else { 
            remoteUser.img = m_thumbnail(
              this.state.user.hs,
              remoteUser.avatar_url,
              64,
              64
            );
          }
          remoteUsers[userId] = remoteUser;
        });

        localRooms[roomId].users = remoteUsers;
        this.setState({
          rooms: localRooms,
          messages: messages
        });
        console.log("neo: done getting userlist for", roomId);
      });
  },

  sync: function() {
    let url = Object.assign({}, this.state.user.hs, {
      pathname: "/_matrix/client/r0/sync",
      query: {
        timeout: 30000,
        access_token: this.state.user.access_token
      }
    });

    if(this.state.user.next_batch != undefined) {
      url.query.since = this.state.user.next_batch;
    }
    rfetch(urllib.format(url), options)
      .then((response) => response.json())
      .catch((error) => {
        console.error('Error:', error);
        this.sync(); //retry
      })
      .then((responseJson) => {
        if (responseJson == undefined) {
          return;
        }

        let remoteRooms = responseJson.rooms.join;
        let remoteInvites = responseJson.rooms.invite;
        let localRooms = this.state.rooms;
        let localInvites = this.state.invites;
        let messages = this.state.messages;

        Object.keys(remoteRooms).forEach((roomId) => {
          let remoteRoom = remoteRooms[roomId];

          let combinedMessages = this.addMessages(roomId, remoteRoom.timeline.events);

          messages[roomId] = combinedMessages;

          function findLast(array, predicate) {
            return array.slice().reverse().find(predicate);
          }

          if (localRooms[roomId] == null) {
            localRooms[roomId] = {};
          }

          localRooms[roomId].lastMessage = findLast(combinedMessages, (message) => {
            return (message.content.body != null);
          });

          localRooms[roomId].lastMessage = defaultValue(
            localRooms[roomId].lastMessage,
            combinedMessages[combinedMessages.length - 1]
          );

          if (localRooms[roomId].lastMessage == undefined) {
            console.log(responseJson, roomId);
            localRooms[roomId].lastMessage = {
              origin_server_ts: 0,
              content: {
                body: ""
              }
            };
          }

          let unsentMessages = this.state.unsentMessages;
          let roomUnsent = unsentMessages[roomId];
          if (roomUnsent != undefined && roomUnsent != {}) {
            let stillUnsentKeys = Object.keys(roomUnsent).filter((msgId) => {
              let val = roomUnsent[msgId];
              if (val.sent) {
                return remoteRoom.timeline.events.every((event) => {
                  if (event.event_id == val.id) {
                    return false;
                  }
                  return true;
                });
              }
              return true;
            });
            let updatedUnsent = {};
            stillUnsentKeys.forEach((key) => {
              updatedUnsent[key] = roomUnsent[key];
            });
            unsentMessages[roomId] = updatedUnsent;
            this.setState({unsentMessages: unsentMessages});
          }

          let unread = defaultValue(
            remoteRoom.unread_notifications.notification_count,
            0
          );

          let highlight = defaultValue(
            remoteRoom.unread_notifications.highlight_count,
            0
          );

          localRooms[roomId].notif = {unread: unread, highlight: highlight};

          if (localRooms[roomId] == null) {
            localRooms[roomId].prev_batch = remoteRoom.timeline.prev_batch;
          }
        });

        Object.keys(remoteInvites).forEach((roomId) => {
          if (localInvites[roomId] != undefined && !this.state.handledInvites[roomId]) {
            //invites will stay in /sync until handled
            return;
          }
          let remoteInvite = remoteInvites[roomId];
          let name = roomId;
          let avatar = blank;
          let invitedBy = null;

          Object.keys(remoteInvite.invite_state.events).forEach((eventId) => {
            let event = remoteInvite.invite_state.events[eventId];
            switch(event.type) {
              case "m.room.name":
                name = event.content.name;
                break;
              case "m.room.avatar":
                avatar = m_download(this.state.user.hs, event.content.url);
                break;
              case "m.room.member":
                if (event.content.membership == "invite") {
                  invitedBy = event.sender;
                }
                break;
            }
          });
          localInvites[roomId] = {display_name: name, avatar: avatar, invitedBy: invitedBy};
        });
        //persistLocalStorage({
        //  messages: messages,
        //  rooms: localRooms
        //});

        let user = Object.assign(this.state.user, {
          next_batch: responseJson.next_batch
        });

        localStorage.setItem("invites", JSON.stringify(localInvites));

        this.setState({
          messages: messages,
          user: user,
          rooms: localRooms,
          invites: localInvites,
        });
        if (!this.state.logout) {
          this.sync();
        }
      });
  },

  addMessages: function (roomId, messages) {
    let concatenatedMessages = defaultValue(this.state.messages[roomId], []).concat(messages);
    let uniqueMessages = uniq(concatenatedMessages, uniqEvents).sort(sortEvents);

    /* FIXME: This should set state as well. */

    return uniqueMessages;
  },

  getBacklog: function(roomId) {
    let messages = this.state.messages;
    let rooms = this.state.rooms;
    let from = rooms[roomId].prev_batch;

    let reqUrl = urllib.format(Object.assign({}, this.state.user.hs, {
      pathname: `/_matrix/client/r0/rooms/${roomId}/messages`,
      query: {
        from: from,
        limit: 50,
        dir: "b",
        access_token: this.state.user.access_token
      }
    }));

    rfetch(reqUrl, options)
      .then((response) => response.json())
      .then((responseJson) => {
        let combinedMessages = this.addMessages(roomId, responseJson.chunk);
        messages[roomId] = combinedMessages;

        rooms[roomId].prev_batch = responseJson.end;
        this.setState({
          messages: messages,
          rooms: rooms,
        });
      });
  },

  removeInvite: function(roomId) {
    let invites = this.state.invites;
    let handledInvites = this.state.handledInvites;
    delete invites[roomId];
    handledInvites[roomId] = true;

    this.setState({
      invites: invites,
      handledInvites: handledInvites
    });
    localStorage.setItem("invites", JSON.stringify(invites));
  },

  render: function() {
    let loading;
    if (this.state.loading) {
      loading = <img className="loading" src={loadingGif} alt="loading"/>;
    }
    if (!this.state.user.access_token) {
      return (
        <div className="login">
          {loading}
          <Login
            loginCallback={this.loginCallback}
            setLoading={this.setLoading}
            setParentState={this.setStateFromChild}
          />
        </div>
      );
    }

    let view;
    if (this.state.room != 0) {
      view = (
        <React.Fragment>
          <Room
            backlog={this.getBacklog}
            messages={this.state.messages[this.state.room]}
            room={this.state.room}
            rooms={this.state.rooms}
            user={this.state.user}
            userinfo={this.state.userinfo}
            get_userinfo={this.get_userinfo}
            unsentMessages={this.state.unsentMessages}
          />
          <div className="input">
            <Send
              room={this.state.room}
              rooms={this.state.rooms}
              user={this.state.user}
              setParentState={this.setStateFromChild}
              unsentMessages={this.state.unsentMessages}
            />
          </div>
        </React.Fragment>
      );
    }

    return (
      <div className="main">
        <div>{loading}</div>
        <RoomList
          room={this.state.room}
          rooms={this.state.rooms}
          invites={this.state.invites}
          user={this.state.user}
          userinfo={this.state.userinfo}
          get_userinfo={this.get_userinfo}
          setParentState={this.setStateFromChild}
          icon={icon}
          logout={this.logout}
          removeInvite={this.removeInvite}
        />
        <div className="view">
          {view}
        </div>
      </div>
    );
  }
});

let Send = create({
  displayName: "Send",
  getInitialState: function() {
    return({
      count: 0,
      selectedOption: 0
    });
  },

  setRef: function(element) {
    if (element != null) {
      element.addEventListener('change',  this.resize_textarea);
      element.addEventListener('cut',     this.resize_textarea_delayed);
      element.addEventListener('paste',   this.resize_textarea_delayed);
      element.addEventListener('drop',    this.resize_textarea_delayed);
      element.addEventListener('keydown', this.resize_textarea_delayed);
      element.addEventListener('keydown', this.shift_enter);
      element.addEventListener('keydown', this.tabComplete);
      this.setState({
        ref: element
      });
    }
  },

  tabComplete: function(event) {
    if (event.keyCode == 9) {
      event.preventDefault();
    }
    if (this.state.completions == undefined || this.state.completions.length > 1) {
      if (event.keyCode == 38 || event.keyCode == 40) {
        event.preventDefault();
      }
    }
    setTimeout(() => {
      let content = event.target.value;
      let cursorPos = event.target.selectionStart;
      let wordStart = content.lastIndexOf(" ", cursorPos);
      if (wordStart == -1) {
        wordStart = 0;
      }
      let word = content.substr(wordStart, cursorPos-wordStart).trim();
      if (!word.startsWith("@")) {
        this.setState({
          completions: []
        });
        return;
      }
      if (event.keyCode == 9) { //tab, update text content
        let completions = this.state.completions;
        let option = this.state.selectedOption;
        if (completions.length != 0 && completions[option] != undefined) { //completion is possible
          let completion = this.state.completions[option][0];
          let completion_parts = completion.split(":");
          completion = completion_parts[0];
          let start = content.substr(0, wordStart);
          if (start.trim() != "") {
            start = start + " ";
          }
          let end = content.substr(cursorPos);
          let replacement = start + completion + end;
          if (replacement != undefined) {
            event.target.value = replacement;
          }
        }
        option = (option + 1) % completions.length;
        if (isNaN(option)) { //why?
          option = 0;
        }

        this.setState({
          selectedOption: option
        });
      } else { //update suggestions
        let completions = getCompletion(this.props.rooms[this.props.room].users, word);
        let option = this.state.selectedOption;
        if (event.keyCode == 38) { // up arrow
          option = (option - 1) % completions.length;
        } else if (event.keyCode == 40) { //down arrow
          option = (option + 1) % completions.length;
        }

        if (isNaN(option)) { //why?
          option = 0;
        }
        this.setState({
          completions: completions,
          selectedOption: option
        });
      }
    }, 1); //to be able to see current text content correctly
  },

  shift_enter: function(event) {
    setTimeout(this.completion, 1);
    if (event.keyCode == 13 && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  },

  resize_textarea: function(element) {
    if (element == undefined) {
      return;
    }
    let ref = element.target;
    if (ref != undefined) {
      ref.style.height = 'auto';
      ref.style.height = ref.scrollHeight+'px';
    }
  },

  resize_textarea_delayed: function(e) {
    setTimeout(() => this.resize_textarea(e), 5);
  },

  send: function() {
    if (this.state.ref == null) {
      return;
    }
    let textarea = this.state.ref;
    if(textarea.value != "") {
      let msg = textarea.value.replace(/^\s+|\s+$/g, '');
      textarea.value = "";
      let unixtime = Date.now();

      let url = urllib.format(Object.assign({}, this.props.user.hs, {
        pathname: `/_matrix/client/r0/rooms/${this.props.room}/send/m.room.message/${unixtime}`,
        query: {
          access_token: this.props.user.access_token
        }
      }));

      let msgId = this.state.count;
      let roomId = this.props.room;
      let unsentMessages = this.props.unsentMessages;
      let roomUnsent = defaultValue(unsentMessages[roomId], {});
      roomUnsent[msgId] = {
        content: {body: msg},
        origin_server_ts: Date.now()
      };

      this.setState({
        count: this.state.count+1
      });
      
      unsentMessages[roomId] = roomUnsent;
      this.props.setParentState("unsentMessages", unsentMessages);

      let body = {
        "msgtype": "m.text",
        "body": msg,
      };

      rfetch(url, {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: new Headers({
          'Content-Type': 'application/json'
        })
      }, options).then(res => res.json())
        .catch(error => console.error('Error:', error))
        .then(response => {
          let unsentMessages = this.props.unsentMessages;
          let roomUnsent = unsentMessages[roomId];
          console.log('Success:', response);
          roomUnsent[msgId].sent = true;
          roomUnsent[msgId].id = response.event_id;
          unsentMessages[roomId] = roomUnsent;
          this.props.setParentState("unsentMessages", unsentMessages);
        });
    }
    textarea.value = "";
    this.resize_textarea();
  },

  render: function() {
    let completions;
    if (this.state.completions != undefined && this.state.completions.length > 0) {
      completions = (
        <div className="completions">
          {
            this.state.completions.map((completion, id) => {
              let className;
              if (id == this.state.selectedOption) {
                className = "active";
              }
              return (
                <div key={completion} className={className}>
                  <img src={completion[2]}/>
                  <b>{completion[1]}</b> {completion[0]}
                </div>
              );
            })
          }
        </div>);
    }
    return (
      <div className="compose">
        <label htmlFor="attachment">
          <img src={icon.file.dark} id="file" className="dark"/>
          <img src={icon.file.light} id="file" className="light"/>
        </label>
        <File
          room={this.props.room}
          user={this.props.user}
          unsentMessages={this.props.unsentMessages}
          setParentState={this.props.setParentState}
        />
        {completions}
        <textarea
          id="text"
          rows="1"
          placeholder="Write a message..."
          ref={this.setRef}
          spellCheck="false">
        </textarea>
        <img src={icon.send.dark} id="send" onClick={() => this.send}className="dark"/>
        <img src={icon.send.light} id="send" onClick={() => this.send} className="light"/>
      </div>
    );
  }
});

let Login = create({
  displayName: "Login",
  getInitialState: function() {
    return ({
      user: "",
      pass: "",
      homeserver: "https://matrix.org",
      json: {},
    });
  },

  render: function() {
    return (
      <center>
        <img id="header" src={neo}/>
        <form id="login">
          <input id="user" type="text" placeholder="username"
            value={this.state.user} onChange={this.handleUser}/><br/>
          <input id="pass" type="password" placeholder="password"
            value={this.state.pass} onChange={this.handlePass}/><br/>
          <input id="hs" type="text" placeholder="homeserver"
            value={this.state.homeserver} onChange={this.handleHs}/><br/>
          <button type="submit" onClick={this.login}>Log in</button>
        </form>
        {this.state.json.error &&
          <span className="error">{this.state.json.error}</span>
        }
      </center>
    );
  },

  handleUser: function(event) {
    this.setState({user: event.target.value});
  },

  handlePass: function(event) {
    this.setState({pass: event.target.value});
  },

  handleHs: function(event) {
    this.setState({homeserver: event.target.value});
  },

  login: function(event) {
    event.preventDefault();
    this.props.setParentState("loading", 1);
    let homeserver = urllib.parse(this.state.homeserver); //TODO: Error handling
    let data = {
      "user": this.state.user,
      "password": this.state.pass,
      "type": "m.login.password",
      "initial_device_display_name": "Neo",
    };

    let url = urllib.format(Object.assign(homeserver, {
      pathname: "/_matrix/client/r0/login"
    }));

    rfetch(url, {
      body: JSON.stringify(data),
      headers: {
        'content-type': 'application/json'
      },
      method: 'POST',
    }, options).then((response) => response.json())
      .then((responseJson) => {
        this.setState({json: responseJson});
        if(responseJson.access_token != undefined) {
          this.props.loginCallback(responseJson);
        }
        this.props.setParentState("loading", 0);
      })
      .catch((error) => {
        this.setState({json: {error: "Error contacting homeserver"}});
        console.error(error);
        this.props.setParentState("loading", 0);
      });
  }
});

let Room = create({
  displayName: "Room",
  getInitialState: function() {
    return({
      scroll: {},
      element: null,
      userPagination: 32,
    });
  },

  setRef: function(element) {
    if (element != null) {
      element.addEventListener("scroll", debounce(this.onScroll, 10));
      this.setState({element: element});
    }
  },

  onScroll: function() {
    this.setState({
      scroll: Object.assign({}, this.state.scroll, {
        [this.props.room]: this.getScroll()
      })
    });
  },

  getScroll: function() {
    if (this.state.element == null) {
      return null;
    }
    return ({
      scrollTop: this.state.element.scrollTop,
      scrollHeight: this.state.element.scrollHeight,
      clientHeight: this.state.element.clientHeight
    });
  },

  userlistScroll: function(e) {
    let object = e.target;
    if (object.scrollHeight - object.scrollTop - object.clientHeight < 100) {
      let userPagination = this.state.userPagination + 50;
      let userListLength = Object.keys(this.props.rooms[this.props.room]).length;
      if (userPagination > userListLength) {
        userPagination = userListLength;
      }
      this.setState({
        userPagination: userPagination
      });
    }
  },
  
  componentDidUpdate: function() {
    if (this.props.room != this.state.lastRoom) {
      this.setState({
        userPagination: 32
      });
      if (this.state.scroll[this.props.room] != undefined) {
        let scrollProps = this.state.scroll[this.props.room];
        if (scrollProps.scrollHeight - scrollProps.scrollTop - scrollProps.clientHeight < 100) {
          this.scrollToBottom();
        } else {
          this.state.element.scrollTop = scrollProps.scrollTop;
        }
      }
      this.setState({
        lastRoom: this.props.room
      });
    }
  },

  scrollToBottom: function() {
    let scrollProps = this.state.scroll[this.props.room];
    this.state.element.scrollTop = scrollProps.scrollHeight - scrollProps.clientHeight + 100;
  },

  render: function() {
    let scroll = {};
    if (this.state.scroll[this.props.room] != null) {
      scroll = this.state.scroll[this.props.room];
    }
    let className = "messages";
    if (this.props.user.settings.bool.split) {
      className += " split";
    }
    let userlist;
    if (this.props.rooms[this.props.room] != undefined) {
      let users = this.props.rooms[this.props.room].users;
      if (users == undefined) {
        return null;
      }
      let sortedUsers = Object.keys(users).sort(sortByUsername);
      let paginatedUsers = sortedUsers.slice(0, this.state.userPagination);
      userlist = paginatedUsers.map((userId) => {
        return (
          <div key={userId} className="user">
            <img id="avatar" src={users[userId].img}/>
            <span className="username">
              <b>{users[userId].display_name}</b><br/>
              {userId}
            </span>
          </div>
        );
      });
    }
    return(
      <div className="message_window_split">
        <div className={className} id="message_window" ref={this.setRef}>
          <Messages
            backlog={this.props.backlog}
            messages={this.props.messages}
            room={this.props.room}
            user={this.props.user}
            scrollToBottom={this.scrollToBottom}
            getScroll={this.getScroll}
            onScroll={this.onScroll}
            scroll={scroll}
            userinfo={this.props.userinfo}
            get_userinfo={this.props.get_userinfo}
            unsentMessages={this.props.unsentMessages}
          />
        </div>
        <div className="userlist" onScroll={this.userlistScroll}>
          {userlist}
        </div>
      </div>
    );
  }
});

let Messages = create({
  displayName: "Messages",
  getInitialState: function() {
    return({
      userinfo: [],
      shouldGoToBottom: 0
    });
  },

  componentDidUpdate: function() {
    let scrollState = this.props.getScroll();

    if (this.props.scroll.scrollTop == null) {
      this.props.onScroll();
      return;
    }

    if (this.props.scroll.scrollHeight != scrollState.scrollHeight) {
      //New messages were added
      if (scrollState.scrollHeight - scrollState.scrollTop - scrollState.clientHeight < 200) {
        this.props.scrollToBottom();
      }
    }
  },

  render: function() {
    if (this.props.room == 0 || this.props.messages == undefined) {
      return null;
    }
    let messages = Object.keys(this.props.messages).map((event_num) => {
      let event = this.props.messages[event_num];
      let next_event = parseInt(event_num)+1;

      if (event.grouped != 1 && event.type == "m.room.message") {
        if (this.props.userinfo[event.sender] == undefined) {
          this.props.get_userinfo(event.sender);
        }

        while (this.props.messages[next_event] != undefined &&
          this.props.messages[next_event].sender == event.sender &&
          this.props.messages[next_event].type == "m.room.message" &&
          (this.props.messages[next_event].content.msgtype == "m.text" ||
            this.props.messages[next_event].content.msgtype == "m.notice" ) &&
          (this.props.messages[next_event].origin_server_ts -
            event.origin_server_ts < 300000) && //max 5 min older
          this.props.messages[next_event].grouped != 1) {
          this.props.messages[next_event].grouped = 1;
          event.content.body += "\n" + this.props.messages[next_event].content.body;
          next_event++;
        }

        return (
          <Message
            key={event.event_id}
            info={this.props.userinfo[event.sender]}
            id={event.sender}
            event={event}
            source={event.sender == this.props.user.user_id ? "out" : "in"}
            group="no"
            user={this.props.user}
          />
        );
      } else if (event.type == "m.room.member") {
        let text = Event.asText(event);
        return (
          <div className="line member" key={event.event_id}>
            {text}
          </div>
        );
      }
      return null;
    });

    let unsentWrap;
    let unsentMessages = this.props.unsentMessages;
    let roomUnsent = defaultValue(unsentMessages[this.props.room], {});
    if (roomUnsent != {}) {
      let unsent = Object.keys(roomUnsent).map((eventId) => {
        let event = roomUnsent[eventId];
        return (
          <Message
            key={eventId}
            info={this.props.userinfo[this.props.user.user_id]}
            event={event}
            group="no"
            user={this.props.user}
            sent={event.sent}
          />
        );
      });
      unsentWrap = (
        <div className="unsent">
          {unsent}
        </div>
      );
    }
    return (
      <div>
        <span onClick={() => this.props.backlog(this.props.room)}>
          Load more messages
        </span><br/>
        {this.props.room}
        {messages}
        {unsentWrap}
      </div>
    );
  }
});

let Message = create({
  displayName: "Message",
  getInitialState: function() {
    return({
      ref: null
    });
  },

  setRef: function(element) {
    if (element != null) {
      this.setState({ref: element});
    }
  },

  render: function() {
    let classArray = ["message", this.props.id];
    if (this.props.event.sent) {
      classArray.push("sent");
    }
    let highlights = this.props.user.settings.input.highlights.split(" ");
    highlights.push(this.props.user.username);
    if (this.props.event.content.body != undefined) {
      highlights.some((highlight) => {
        if (highlight == "") {
          return false;
        }
        if (this.props.event.content.body.includes(highlight)) {
          classArray.push("mention");
          return true;
        }
        return false;
      });
    }
    if (!this.props.user.settings.bool.bubbles) {
      classArray.push("nobubble");
    }
    classArray = classArray.join(" ");

    let time = new Date(this.props.event.origin_server_ts);
    let time_string = time.getHours().toString().padStart(2, "0") +
      ":" + time.getMinutes().toString().padStart(2, "0");

    let media = "";
    let media_width = "";
    if (this.props.event.content.msgtype == "m.image") {
      classArray += " media";
      if (this.props.event.content.info == undefined) {
        let url = m_download(this.props.user.hs, this.props.event.content.url);
        media = displayMedia("image", this.state.ref, url, url);
      } else if (this.props.event.content.info.thumbnail_info == undefined) {
        let url = m_download(this.props.user.hs, this.props.event.content.url);
        if (this.props.event.content.info.h != undefined && this.props.event.content.info.w != undefined) {
          media = displayMedia("image", this.state.ref, url, url, this.props.event.content.info.h, this.props.event.content.info.w);
        } else {
          media = displayMedia("image", this.state.ref, url, url);
        }
      } else {
        media_width = this.props.event.content.info.thumbnail_info.w;
        let media_url = this.props.event.content.info.thumbnail_url;
        if (this.props.event.content.info.mimetype == "image/gif") {
          media_url = this.props.event.content.url;
        }

        media = displayMedia(
          "image",
          this.state.ref,
          m_download(this.props.user.hs, this.props.event.content.url),
          m_download(this.props.user.hs, media_url),
          this.props.event.content.info.thumbnail_info.h,
          this.props.event.content.info.thumbnail_info.w
        );
      }
    } else if (this.props.event.content.msgtype == "m.video") {
      let thumb = "";
      if (this.props.event.content.info != undefined &&
        this.props.event.content.info.thumbnail_url != undefined) {
        thumb = m_download(this.props.user.hs, this.props.event.content.info.thumbnail_url);
      }
      media = displayMedia(
        "video",
        this.state.ref,
        m_download(this.props.user.hs, this.props.event.content.url),
        thumb,
        this.props.event.content.info.thumbnail_info.h,
        this.props.event.content.info.thumbnail_info.w
      );
      
    } else if (this.props.event.content.msgtype == "m.file") {
      media = <a
        className="file"
        target="_blank" 
        href={m_download(this.props.user.hs, this.props.event.content.url)}
      >
        <span>file download</span>
      </a>;
    } else {
      if (!this.props.event.content.msgtype == "m.text") {
        console.log(this.props.event);
      }
    }

    if (this.props.event.content.body == undefined) {
      return null;
    }

    let content = (
      this.props.event.content.body.split('\n').map((item, key) => {
        let items = item.split(" ").map((str, key) => {
          let returnVal = str + " ";
          highlights.some((highlight) => {
            if (highlight == "") {
              return false;
            }
            if (str.includes(highlight)) {
              returnVal = <span key={key} className="highlight">{str} </span>;
              return true;
            }
            return false;
          });
          return returnVal;
        });
        return <span key={key}>{items}<br/></span>;
      })
    );

    let link = <Linkify component={LinkInfo} properties={{user: this.props.user}}>
      {content}
    </Linkify>;

    return (
      <div className={"line " + this.props.source} ref={this.setRef}>
        <img id="avatar" src={this.props.info.img} onError={(e)=>{e.target.src = blank;}}/>
        <div className={classArray} id={this.props.id} style={{width: media_width}}>
          <div>
            <b>{this.props.info.display_name}</b>
            {media}
            <div className="flex">
              <p>
                {link}
              </p>
              <span className="timestamp">{time_string}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
});

let LinkInfo = create({
  displayName: "LinkInfo",
  getInitialState: function() {
    return({
      img: null,
      url: ""
    });
  },

  componentDidMount: function() {
    let url = this.props.href;
    this.setState({
      url: url
    });

    let m_url = urllib.format(Object.assign({}, this.props.user.hs, {
      pathname: "/_matrix/media/r0/preview_url/",
      query: {
        url: url,
        access_token: this.props.user.access_token
      }
    }));

    rfetch(m_url)
      .then(response => response.json())
      .then(responseJson => {
        if (responseJson["og:image"] != undefined && responseJson["og:title"] == undefined) {
          //link is just an image
          this.setState({
            img: m_download(this.props.user.hs, responseJson["og:image"]),
            h: responseJson["og:image:height"],
            w: responseJson["og:image:width"]
          });
        }
      });
  },

  render: function() {
    if (this.state.img) {
      return(
        <span>
          <a href={this.props.href} target="_blank">{this.props.children}</a><br/>
          <img className="link" src={this.state.img} style={{minHeight: this.state.h, minWidth: this.state.w}}/>
        </span>
      );
    }

    return (
      <a href={this.props.href} target="_blank">{this.props.children}</a>
    );
  }
});

function m_thumbnail(hs, mxc, w, h) {
  return urllib.format(Object.assign({}, hs, {
    pathname: `/_matrix/media/r0/thumbnail/${mxc.substring(6)}`,
    query: {
      width: w,
      height: h
    }
  }));
}

function m_download(hs, mxc) {
  return urllib.format(Object.assign({}, hs, {
    pathname: `/_matrix/media/r0/download/${mxc.substring(6)}`
  }));
}

function sortEvents(a, b) {
  return a.origin_server_ts-b.origin_server_ts;
}

function uniqEvents(a, b) {
  return a.event_id === b.event_id;
}

function sortByUsername(a, b) {
  var nameA = a.toUpperCase();
  var nameB = b.toUpperCase();
  if (nameA < nameB) {
    return -1;
  }
  if (nameA > nameB) {
    return 1;
  }
  return 0;
}

function displayMedia(type, container, src, thumb, h, w) {
  if (container == null) {
    return null;
  }

  let newHeight;
  let newWidth;

  let maxHeight = 600;
  let maxWidth = container.clientWidth - 70;

  let hRatio = maxHeight/h;
  let wRatio = maxWidth/w;

  if (hRatio <= wRatio) {
    newHeight = maxHeight;
  }
  if (hRatio >= wRatio) {
    newWidth = maxWidth;
  }

  if (type == "image") {
    return(
      <div>
        <a target="_blank" href={src}>
          <img
            src={thumb}
            style={{maxHeight: newHeight, maxWidth: newWidth}}
          />
        </a>
      </div>
    );
  } else if (type == "video") {
    return(
      <video
        src={src}
        poster={thumb}
        controls
        style={{maxHeight: newHeight, maxWidth: newWidth}}
      ></video>
    );
  }
}

function getCompletion(list, str) {
  let completionList = [];
  console.log("neo: getting completion for", str);
  if (str.trim() == "") {
    return completionList;
  }
  str = str.toUpperCase();
  Object.keys(list).forEach((completion) => {
    if (completion.toUpperCase().includes(str) || list[completion].display_name.toUpperCase().includes(str)) {
      completionList.push([completion, list[completion].display_name, list[completion].img]);
    }
  });
  return(completionList);
}

ReactDOM.render(
  <App />,
  document.getElementById('root')
);
