const axios = require('axios');
const fs = require('fs');

module.exports = {
 config: {
 name: 'note',
 aliases: ["ghichu"],
 version: '0.0.1',
 role: 3,
 author: 'DC-Nam',
 info: 'note ',
 Category: 'Admin',
 guides: '[]',
 cd: 3,
 hasPrefix: true,
 images: []
 },
 onRun: async function(o) {
 const name = module.exports.config.name;
 const url = o.event?.messageReply?.args?.[0] || o.args[1];
 let path = `${__dirname}/${o.args[0]}`;
 const send = msg=>new Promise(r=>o.api.sendMessage(msg, o.event.threadID, (err, res)=>r(res), o.event.messageID));

 try {
 if (/^https:\/\//.test(url)) {
 return send(`🔗 File: ${path}\n\nThả cảm xúc để xác nhận thay thế nội dung file`).then(res=> {
 res = {
 ...res,
 name,
 path,
 o,
 url,
 action: 'confirm_replace_content',
 };
 global.concac.onReaction.push(res);
 });
 } else {
 //if (o.args[0] === 'edit' && o.args[1])path = `${__dirname}/${o.args[1]}`;
 if (!fs.existsSync(path))return send(`❎ Đường dẫn file không tồn tại để export`);
 const uuid_raw = require('uuid').v4();
 const url_raw = new URL(`https://note.subhatde.id.vn/note/${uuid_raw}`);
 const url_redirect = new URL(`https://note.subhatde.id.vn/note/${require('uuid').v4()}`);
 await axios.put(url_raw.href, fs.readFileSync(path, 'utf8'));
 url_redirect.searchParams.append('raw', uuid_raw);
 await axios.put(url_redirect.href);
 url_redirect.searchParams.delete('raw');
 return send(`📝 Raw: ${url_redirect.href}\n\n✏️ Edit: ${url_raw.href}\n────────────────\n• File: ${path}\n\n📌 Thả cảm xúc để upload code`).then(res=> {
 res = {
 ...res,
 name,
 path,
 o,
 url: url_redirect.href,
 action: 'confirm_replace_content',
 };
 global.concac.onReaction.push(res);
 });
 }
 } catch(e) {
 console.error(e);
 send(e.toString());
 }
 },
 onReaction: async function(o) {
 const _ = o.onReaction;
 const send = msg=>new Promise(r=>o.api.sendMessage(msg, o.event.threadID, (err, res)=>r(res), o.event.messageID));

 try {
 if (o.event.userID != _.o.event.senderID)return;

 switch (_.action) {
 case 'confirm_replace_content': {
 const content = (await axios.get(_.url, {
 responseType: 'text',
 })).data;

 fs.writeFileSync(_.path, content);
 send(`✅ Đã upload code thành công\n\n🔗 File: ${_.path}`).then(res=> {
 res = {
 ..._,
 ...res,
 };
 global.concac.onReaction.push(res);
 });
 };
 break;
 default:
 break;
 }
 } catch(e) {
 console.error(e);
 send(e.toString());
 }
 }
}
