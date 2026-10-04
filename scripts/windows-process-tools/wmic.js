// Read-only WMIC subset used by api.sh. Windows Script Host JScript syntax.
function refuse(message) {
    WScript.StdErr.WriteLine("ERROR: WMI process adapter: " + message);
    WScript.Quit(1);
}
var args = [];
for (var a = 0; a < WScript.Arguments.length; a++)
    args.push(String(WScript.Arguments(a)));
if (args.length < 4 || args[0].toLowerCase() !== "process")
    refuse("only process queries are supported");
var cursor = 1;
var filter = "";
if (args[cursor].toLowerCase() === "where") {
    filter = args[++cursor];
    if (!/^ProcessId=[0-9]+$/i.test(filter || ""))
        refuse("only a numeric ProcessId filter is supported");
    cursor++;
}
if (!args[cursor] || args[cursor].toLowerCase() !== "get")
    refuse("only get queries are supported");
var fields = String(args[++cursor] || "").split(",");
var allowed = { processid: "ProcessId", parentprocessid: "ParentProcessId",
    commandline: "CommandLine", creationdate: "CreationDate" };
var seen = {};
for (var i = 0; i < fields.length; i++) {
    var canonical = allowed[fields[i].toLowerCase()];
    if (!canonical || seen[canonical])
        refuse("unsupported or duplicate field");
    fields[i] = canonical;
    seen[canonical] = true;
}
fields.sort();
var format = String(args[++cursor] || "").toLowerCase();
if ((format !== "/value" && format !== "/format:csv") || cursor !== args.length - 1)
    refuse("expected /value or /format:csv");
var csv = format === "/format:csv";
try {
    var service = GetObject("winmgmts:{impersonationLevel=impersonate}!\\\\.\\root\\cimv2");
    var query = "SELECT " + fields.join(",") + " FROM Win32_Process" + (filter ? " WHERE " + filter : "");
    var rows = new Enumerator(service.ExecQuery(query, "WQL", 48));
    if (csv) WScript.Echo("Node," + fields.join(","));
    for (; !rows.atEnd(); rows.moveNext()) {
        var item = rows.item();
        var values = [];
        for (var n = 0; n < fields.length; n++) {
            var value = item.Properties_.Item(fields[n]).Value;
            value = value == null ? "" : String(value).replace(/[\r\n]/g, " ");
            if (csv) values.push(value);
            else WScript.Echo(fields[n] + "=" + value);
        }
        // api.sh reconstructs command lines containing commas from middle fields.
        if (csv) WScript.Echo("localhost," + values.join(","));
    }
} catch (error) {
    refuse(error.description || error.message || String(error));
}
