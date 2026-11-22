/**
 * Everra inbox bridge for the Tasks app.
 * Paste into a new Google Apps Script project (script.google.com), set SECRET,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * It returns recent Gmail messages that were sent to your Everra address
 * (forwarded from Tasjeel cPanel to this Gmail account).
 */
var SECRET = 'PUT-YOUR-SECRET-CODE-HERE';
var DAYS = 14;
var MAX = 40;

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!SECRET || p.key !== SECRET) return json_({ ok: false, error: 'bad-key' });
  var addr = String(p.addr || '').trim().toLowerCase();
  if (!/^[^\s@"()<>]+@[^\s@"()<>]+\.[^\s@"()<>]+$/.test(addr)) return json_({ ok: false, error: 'bad-addr' });

  var query = '(to:' + addr + ' OR cc:' + addr + ' OR deliveredto:' + addr + ') newer_than:' + DAYS + 'd -in:sent -in:chats';
  var threads = GmailApp.search(query, 0, MAX);
  var items = [];
  threads.forEach(function (th) {
    var msgs = th.getMessages();
    var m = msgs[msgs.length - 1];
    var from = m.getFrom() || '';
    var match = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
    var body = m.getPlainBody() || '';
    items.push({
      id: m.getId(),
      threadId: th.getId(),
      fromName: match ? match[1].trim() : '',
      from: match ? match[2].trim() : from,
      subject: m.getSubject() || '',
      snippet: body.replace(/\s+/g, ' ').trim().slice(0, 280),
      date: m.getDate().getTime(),
      unread: m.isUnread()
    });
  });
  items.sort(function (a, b) { return b.date - a.date; });
  return json_({ ok: true, items: items });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
