'use strict'

// Disclaimer: this code is quite messy, and will need a rewrite sometime
// read at your own risk ;)

const React = require('react')
const ReactDOM = require('react-dom')
const create = require('create-react-class')
const Promise = require('bluebird')
const rfetch = require('fetch-retry')
const urllib = require('url')

const icons = require('./icons.js')

let apiUrl = urllib.parse("https://federationtester.matrix.org/api/report")
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
    window.location.hash = this.state.ref.value.toLowerCase();

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
        // The tldr block will be displayed before the full table
        let tldr = []
        Object.keys(json.ConnectionReports).forEach((ip) => {
          let report = json.ConnectionReports[ip]
          if (!report.Checks.ValidCertificates) {
            tldr.push(<div className="warning" key={`cert-${tldr.length}`}>
              WARN: Could not find a valid certificate for {ip}.
              See <a href="https://github.com/matrix-org/synapse/blob/master/docs/MSC1711_certificates_FAQ.md#configuring-certificates-for-compatibility-with-synapse-100">this
              documentation</a> for instructions on how to fix this.
            </div>)
          }
          json.ConnectionReports[ip].Errors.forEach((err) => {
              let msg = err.Message
              // Found an error
              tldr.push(<div className="error" key={`${msg}-${tldr.length}`}>
                ERROR: on {ip}: {msg}
              </div>)
          })
        })
        if (Object.values(json.ConnectionReports).some(e=>!e.Checks.MatchingServerName)) {
          tldr.push(
              <div className="warning" key={`servername-${tldr.length}`}>
              It is possible that the MatchingServerName error below is
              caused by you entering the wrong URL in the federation tester,
              not because there is an actual issue with your federation.
              You should enter the server name into the Federation Tester,
              not the location where your server is. The server name is the
              public facing name of your server that appears at the end of
              usernames and room aliases.
              </div>
            )
        }
        this.setState({
          json: json,
          tldr: tldr,
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
      // Display server version information
      const serverVersion = this.state.json.Version;
      let version;
      if (serverVersion == undefined) {
        version = "This homeserver does not supply version information"
      } else if (serverVersion.error != undefined) {
        version = `There was an error looking up homeserver version information: ${serverVersion.error}`;
      } else {
        version = `Homeserver version: ${serverVersion.name} ${serverVersion.version}`;
      }

      let reportCount = Object.keys(this.state.json.ConnectionReports).length
      result = <>
        Got {reportCount} connection report{reportCount > 1 && <>s</>}.
        {reportCount == 0 && <> This usually means at least one error happened.</>}

        {reportCount > 0 &&
          <div className="serverVersion">
            <p>{version}</p>
          </div>
        }

        <div className="tldr">
          {this.state.tldr}
        </div>
        <TestResults json={this.state.json}/>
      </>
    }

    return (
      <div className="block">
        <div className="text">
          The Matrix Federation Tester can help debug your Matrix instance.<br />
          Enter your server name in the field below, then hit "Go" to get your report.<br/><br/>
          Made with love by <a href="https://f.0x52.eu">f0x</a>, sourcecode <a href="https://github.com/matrix-org/fed-tester-ui">here</a>, powered by the <a href="https://github.com/matrix-org/matrix-federation-tester">matrix-federation-tester</a> backend <br/>
      <a href="https://liberapay.com/f0x/donate"><img alt="Donate using Liberapay" src="https://liberapay.com/assets/widgets/donate.svg"/></a>
        </div>
        <div className="input">
          <input ref={this.setRef} placeholder="servername.com"/>
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
        <API/>
      </div>
    );
  }
})

let ConnectionReports = create({
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
      collapsed: {
        info: true,
        checks: this.props.info.Checks.AllChecksOK
      }
    });
  },

  toggle: function(element) {
    let collapsed = this.state.collapsed
    collapsed[element] = !collapsed[element]
    this.setState({
      collapsed: collapsed
    });
  },

  render: function() {
    let checks = <TableFromObject object={this.props.info.Checks} collapsed={this.state.collapsed.checks} tree={1} type="error" />;
    let checksIcon = icons.right;

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
      cert: {
        symbol: "Warning",
        className: "warn"
      }
    }

    if (!this.state.collapsed["checks"]) {
      checksIcon = icons.down;
    }

    if (this.props.info.Checks.AllChecksOK) {
      rows.checks = trueRow
    }

    if (this.props.info.Checks.ValidCertificates) {
      rows.cert = trueRow
    }

    return (
      <div>
        <h3>{this.props.ip}</h3>
        <div className="table">
          <div className="body">
            <div className="row toggle" onClick={() => this.toggle("checks")}>
              {checksIcon}
              <div className="col">Checks</div>
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
      let symbol
      let className
      if (this.props.type == "error") {
        symbol = "Error";
        className = "false";
        if (this.props.object[check]) {
          symbol = "Success";
          className = "true";
        }
      }

      if (check == "AllChecksOK") {
        return null;
      } else if (!this.props.collapsed) {
        if (typeof(this.props.object[check]) == "boolean") {
          return (
            <div className={`row tree-${this.props.tree} ${this.props.type}Row`} key={id}>
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
              <div className={"row tree-" + this.props.tree} onClick={this.toggle}>
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
    const j = this.props.json;

    const skippedDnsResultTitle = <p>server name/.well-known result contains explicit port number: no SRV lookup done</p>;
    const foundDnsResultTitle = <h3>DNS records for {j.SRVCName}</h3>;
    const dnsResultTitle = j.SRVSkipped ? skippedDnsResultTitle : foundDnsResultTitle;

    const srvRecordsTable = function() {
      if (j.SRVRecords != null) {
        const recordRows = j.SRVRecords.map((record, id) => {
          return (
            <div className="row" key={id}>
              <div className="col">{record.Target}</div>
              <div className="col">{record.Port}</div>
              <div className="col">{record.Priority}</div>
              <div className="col">{record.Weight}</div>
            </div>
          );
        });

        return (
          <>
            <div className="table">
              <div className="header">
                <span className="col">Target</span>
                <span className="col">Port</span>
                <span className="col">Priority</span>
                <span className="col">Weight</span>
              </div>
              <div className="body">
                {recordRows}
              </div>
            </div>
          </>
        );
      }
    }();

    const hosts = Object.keys(j.Hosts).map((host) => {
      const addresses = function() {
        if (j.Hosts[host].Addrs != null) {
          return j.Hosts[host].Addrs.map((address, id) => {
            return (
              <div className="row" key={id}>
                <div className="col">{address}</div>
              </div>
            );
          })
        }
      }();

      const errors = function() {
        if (j.Hosts[host].Error != null) {
          return (
            <div className="row" key={host}>
              <div className="col">{j.Hosts[host].Error.Message}</div>
            </div>
          );
        }
      }();

      const header = <h4>{host}</h4>;
      const addressTable = <>
            <div className="head">
                Addresses
            </div>
            <div className="body">
              {addresses}
            </div>
          </>;
      const errorTable = <>
          <div className="head error">
            Errors
          </div>
          <div className="body error">
            {errors}
          </div>
        </>;

      // Prevent having an empty table with only the header of the address or errors table.
      if (addresses == undefined) {
        return (
          <>
            {header}
            {errorTable}
          </>
        );
      } else if (errors == undefined) {
        return (
          <>
            {header}
            {addressTable}
          </>
        );
      }
      return (
        <>
          {header}
          {addressTable}
          {errorTable}
        </>
      );
    });

    return (
      <div className="dns">
        <h2>DNS results</h2>
        {dnsResultTitle}
        {srvRecordsTable}
        <div className="table">
          <h3>Hosts</h3>
          {hosts}
        </div>
      </div>
    );
  }
});

let API = create({
  displayName: "API",

  render: function() {
    return (
      <div className="apiLink">
        View the <a href={urllib.format(apiUrl)}>json report</a>.
      </div>
    );
  }
});

ReactDOM.render(
  <App />,
  document.getElementById('root')
)
