'use strict'
const React = require('react')
const ReactDOM = require('react-dom')
const create = require('create-react-class')
const Promise = require('bluebird')
const rfetch = require('fetch-retry')
const urllib = require('url')

const icons = require('./icons.js')

let apiUrl = urllib.parse("https://neo.lain.haus/api/report")
let options = {retries: 5, retryDelay: 200}

let App = create({
  displayName: "App",

  getInitialState: function() {
    return({
      json: undefined
    })
  },

  componentDidMount: function() {
    setTimeout(() => {
      if (window.location.hash) {
        var hash = window.location.hash.substring(1)
        this.state.ref.value = hash
        this.submit()
      }
    }, 100)
  },

  setRef: function(e) {
    if (e == null) {
      return
    }
    e.addEventListener('keydown', (e) => {
      if (e.keyCode == 13) {
        this.submit()
      }
    })
    e.focus()
    this.setState({
      ref: e
    })
  },

  submit: function() {
    let url = Object.assign(apiUrl, {
      query: {
        server_name: this.state.ref.value.toLowerCase()
      }
    })

    this.setState({
      loading: true,
      json: undefined
    })

    console.log("Querying API", urllib.format(url))
    rfetch(urllib.format(url), options)
      .then((res) => res.json())
      .then((json) => {
        let errors = []
        Object.keys(json.ConnectionReports).forEach((ip) => {
          if (!json.ConnectionReports[ip].ValidCertificates) {
            errors.push(<div className="jsonError" key={`cert-${errors.length}`}>
              Invalid self-signed cert found for {ip}
            </div>)
          }
          recursiveCheck(json.ConnectionReports[ip].Checks, "Checks", (path) => {
            // Found an error
            errors.push(<div className="jsonError" key={`${path}-${errors.length}`}>
              Error found for {ip}: {path}
            </div>)
          })
        })
        this.setState({
          json: json,
          jsonErrors: errors,
          loading: false
        })
      })
  },

  render: function() {
    let result
    let errors
    let active = ""

    if (this.state.loading) {
      active = " active";
    }

    if (this.state.json != undefined) {
      let reportCount = Object.keys(this.state.json.ConnectionReports).length
      if (reportCount == 0) {
        errors = (
          <div className="error">
            No connection reports, is this even a matrix server?
          </div>
        )
      } else {
        result = <>
          Got {reportCount} connection report
          {reportCount > 1 && <>s</>}
          {this.state.jsonErrors.length > 0 &&
            <> and {this.state.jsonErrors.length} error
              {this.state.jsonErrors.length > 1 && <>s</>}
          </>}

          {this.state.jsonErrors}
          <TestResults json={this.state.json}/>
        </>
      }
    }

    return (
      <div className="block">
        <div className="text">
          <span id="jok">unlike the name suggests, this won't help you find three letter agencies :p</span><br/>
          However, it might help you debug your Matrix instance<br/><br/>
        Made with love by <a href="https://f.0x52.eu">f0x</a>, sourcecode <a href="https://git.lain.haus/f0x/fed-tester">here</a>
        </div>
        <div className="input">
          <input ref={this.setRef}/>
          <div className={"sk-cube-grid" + active} onClick={this.submit}>
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
    )
  }
})

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
})

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
      if (info.Message != null) {
        return info.Message;
      }
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
    let icon = icons.right;

    let falseRow = {
      symbol: "Error",
      className: "false"
    }

    let trueRow = {
      symbol: "Success",
      className: "true"
    }

    let rows = {
      checks: falseRow,
      cert: falseRow
    }

    if (!this.state.collapsed) {
      icon = icons.down;
    }

    if (this.props.info.Checks.AllChecksOK) {
      rows.checks = trueRow
    }

    if (this.props.info.ValidCertificates) {
      rows.cert = trueRow
    }

    return (
      <div>
        <h3>{this.props.ip}</h3>
        <div className="table">
          <div className="body">
            <div className="row">
              <div className="col">Valid Certificate</div>
              <div className={"col bool " + rows.cert.className}>{rows.cert.symbol}</div>
            </div>
            <div className="row toggle" onClick={this.toggle}>
              {icon}
              <div className="col">Other Checks</div>
              <div className={"col bool " + rows.checks.className}>{rows.checks.symbol}</div>
            </div>
            {checks}
          </div>
        </div>
      </div>
    );
  }
});

function recursiveCheck(objectOrBool, path, bubble) {
  if (typeof objectOrBool == typeof true) {
    if (!objectOrBool) {
      if (bubble) {
        bubble(path)
      }
      return true
    }
  } else {
    let anyErrors
    Object.keys(objectOrBool).forEach((childKey) => {
      let childValue = objectOrBool[childKey]
      if (recursiveCheck(childValue, path + `.${childKey}`, bubble)) {
        anyErrors = true
      }
    })
    if (anyErrors) {
      return true
    }
  }
}

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
          let childrenBool = "true"
          let childrenSymbol = "Success"
          if (recursiveCheck(this.props.object[check], "Checks")) {
            //will return true if any children are false
            childrenBool = "false"
            childrenSymbol = "Error"
          }
          return (
            <div key={id}>
              <div className={"row toggle tree-" + this.props.tree} onClick={this.toggle}>
                <div className="col">{check}</div>
                <div className={"col bool " + childrenBool}>{childrenSymbol}</div>
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
    if (j.SRVRecords == null) {
      return (
        <div className="dns">
          <h2>No SRV Records</h2>
        </div>
      );
    }

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
        <h2>DNS records for {j.SRVCName}</h2>
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
)
