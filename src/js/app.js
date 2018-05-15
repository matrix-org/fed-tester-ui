'use strict';

const React = require('react');
const ReactDOM = require('react-dom');
const rfetch = require('fetch-retry');

require('../scss/layout.scss');

let create = require('create-react-class');

let urllib = require('url');
let apiUrl = urllib.parse("https://neo.lain.haus/api/report");
let neo = require('../assets/neo_full_bg.png');

let options = {retries: 5, retryDelay: 200};

let App = create({
  displayName: "App",

  getInitialState: function() {
    return({
      json: undefined
    });
  },

  setRef: function(e) {
    e.addEventListener('keydown', this.onKey);
    e.focus();
    this.setState({
      ref: e
    });
  },

  onKey: function(e) {
    if (e.keyCode == 13) {
      this.submit();
    }
  },

  submit: function() {
    let url = Object.assign(apiUrl, {
      query: {
        server_name: this.state.ref.value
      }
    });
    
    this.setState({
      loading: true,
      json: undefined
    });

    rfetch(urllib.format(url), options)
      .then((res) => res.json())
      .then((json) => {
        console.log(json);
        this.setState({
          json: json,
          loading: false
        });
      });
  },

  render: function() {
    let result;
    let errors;
    let active;

    if (this.state.json != undefined) {
      if (this.state.json.DNSResult.SRVRecords != undefined) {
        result = <TestResults json={this.state.json}/>;
      }

      if (this.state.json.DNSResult.SRVError != undefined) {
        errors = (
          <div className="error">
            {this.state.json.DNSResult.SRVError.Message}
          </div>
        );
      }
    }

    if (this.state.loading) {
      active = "active";
    }

    return (
      <div className="block">
        <a href="https://neo.lain.haus" target="_blank"><img src={neo}/></a>
        <span id="jok">Unlike the name suggests, this won't help you find three letter agencies :P</span>
        <div className="input">
          <input ref={this.setRef}/>
          <div className={"sk-cube-grid " + active} onClick={this.submit}>
            <span>Go</span>
            <div className="sk-cube sk-cube1"></div>
            <div className="sk-cube sk-cube2"></div>
            <div className="sk-cube sk-cube3"></div>
            <div className="sk-cube sk-cube4"></div>
            <div className="sk-cube sk-cube5"></div>
            <div className="sk-cube sk-cube6"></div>
            <div className="sk-cube sk-cube7"></div>
            <div className="sk-cube sk-cube8"></div>
            <div className="sk-cube sk-cube9"></div>
          </div>
        </div>
        {result}
        {errors}
      </div>
    );
  }
});

let TestResults = create({
  displayName: "TestResults",

  render: function() {
    return (
      <div className="results">
        <ConnectionErrors json={this.props.json.ConnectionErrors}/>
        <ConnectionReports json={this.props.json.ConnectionReports}/>
        <DNSResult json={this.props.json.DNSResult}/>
      </div>
    );
  }
});

let ConnectionReports = create({
  displayName: "ConnectionErrors",

  render: function() {
    let j = this.props.json;
    let connections = Object.keys(j).map((ip, id) => {
      let info = j[ip];
      return <ReportTable info={info} key={id} ip={ip}/>;
    });
    return (
      <div className="connection">
        <h2>Connection Reports</h2>
        {connections}
      </div>
    );
  }
});

let ConnectionErrors = create({
  displayName: "ConnectionErrors",

  render: function() {
    let j = this.props.json;
    if (Object.keys(j).length == 0) {
      return null;
    }
    let connections = Object.keys(j).map((ip, id) => {
      let info = j[ip];
      return <ReportTable info={info} key={id} ip={ip}/>;
    });
    return (
      <div className="connection err">
        <h2>Connection Errors</h2>
        {connections}
      </div>
    );
  }
});

let ReportTable = create({
  displayName: "ReportTable",

  getInitialState: function() {
    return ({
      collapsed: this.props.info.Checks.AllChecksOK
    });
  },

  toggle: function() {
    let collapsed = this.state.collapsed;
    if (collapsed) {
      collapsed = false;
    } else {
      collapsed = true;
    }
    this.setState({
      collapsed: collapsed
    });
  },

  render: function() {
    let checks = <TableFromObject object={this.props.info.Checks} collapsed={this.state.collapsed} tree={1}/>;
    let symbol = "Error";
    let className = "false";
    if (this.props.info.Checks.AllChecksOK) {
      symbol = "Success";
      className = "true";
    }
    return (
      <div>
        <h3>{this.props.ip}</h3>
        <div className="table">
          <div className="head">
            Check
          </div>
          <div className="body">
            <div className="row toggle" onClick={this.toggle}>
              <div className="col">All Checks OK</div>
              <div className={"col bool " + className}>{symbol}</div>
            </div>
            {checks}
          </div>
        </div>
      </div>
    );
  }
});

let TableFromObject = create({
  displayName: "TableFromObject",

  getInitialState: function() {
    return ({
      collapsed: this.props.collapsed
    });
  },

  toggle: function() {
    let collapsed = this.state.collapsed;
    if (collapsed) {
      collapsed = false;
    } else {
      collapsed = true;
    }
    this.setState({
      collapsed: collapsed
    });
  },

  render: function() {
    let objectArray = Object.keys(this.props.object);
    return objectArray.map((check, id) => {
      let symbol = "Error";
      let className = "false";
      if (this.props.object[check]) {
        symbol = "Success";
        className = "true";
      }
    
      if (check == "AllChecksOK") {
        return null;
      } else if (!this.props.collapsed) {
        if (typeof(this.props.object[check]) == "boolean") {
          return (
            <div className={"row toggle tree-" + this.props.tree} key={id}>
              <div className="col">{check}</div>
              <div className={"col bool " + className}>{symbol}</div>
            </div>
          );
        } else {
          return (
            <div key={id}>
              <div className={"row toggle tree-" + this.props.tree} onClick={this.toggle}>
                <div className="col">{check}</div>
              </div>
              <TableFromObject object={this.props.object[check]} collapsed={false} key={id} tree={this.props.tree+1} />
            </div>
          );
        }
      }
      return null;
    });
  }
});

let DNSResult = create({
  displayName: "DNS",

  render: function() {
    let j = this.props.json;
    let records = j.SRVRecords.map((record, id) => {
      return (
        <div className="row" key={id}>
          <div className="col">{record.Target}</div>
          <div className="col">{record.Port}</div>
          <div className="col">{record.Priority}</div>
          <div className="col">{record.Target}</div>
        </div>
      );
    });

    let hosts = Object.keys(j.Hosts).map((host) => {
      return j.Hosts[host].Addrs.map((address, id) => {
        return (
          <div className="row" key={id}>
            <div className="col">{address}</div>
          </div>
        );
      });
    });

    return (
      <div className="dns">
        <h2>{j.SRVCName} records:</h2>
        <div className="table">
          <div className="header">
            <span className="col">Target</span>
            <span className="col">Port</span>
            <span className="col">Priority</span>
            <span className="col">Target</span>
          </div>
          <div className="body">
            {records}
          </div>
        </div>
        <div className="table">
          <div className="head">
            Address
          </div>
          <div className="body">
            {hosts}
          </div>
        </div>
      </div>
    );
  }
});

ReactDOM.render(
  <App />,
  document.getElementById('root')
);
