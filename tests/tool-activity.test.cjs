const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function buildActivity() {
  const bubble = {
    children:[],
    querySelector(selector) {
      return selector === '.xy-tool-live' ? this.children.find(x => x.className === 'xy-tool-live') || null : null;
    },
    appendChild(element) { this.children.push(element); }
  };
  let current = {id:'chat-1'};
  const document = {
    querySelector(selector) {
      return selector === '#messages #typing .bubble' ? bubble : null;
    },
    createElement() { return {className:'',innerHTML:''}; }
  };
  const context = {window:{},document,chat:()=>current};
  const code = fs.readFileSync(path.join(__dirname,'..','tool-activity.js'),'utf8');
  vm.runInNewContext(code,context);
  return {activity:context.window.xyToolActivity,bubble,switchChat:id=>{current={id};}};
}

test('tool previews redact credentials, bearer tokens, and media data',()=>{
  const {activity}=buildActivity();
  const result=activity.preview({
    apiKey:'DO_NOT_SHOW',
    nested:{password:'HIDDEN_PASSWORD'},
    text:'Bearer abcdef123 and password: open-sesame',
    image:'data:image/png;base64,AAAABBBB',
    note:'visible'
  });
  assert.equal(result.includes('DO_NOT_SHOW'),false);
  assert.equal(result.includes('HIDDEN_PASSWORD'),false);
  assert.equal(result.includes('abcdef123'),false);
  assert.equal(result.includes('open-sesame'),false);
  assert.equal(result.includes('AAAABBBB'),false);
  assert.equal(result.includes('visible'),true);
});

test('tool previews are bounded and tool labels are HTML escaped',()=>{
  const {activity}=buildActivity();
  assert.ok(activity.preview('x'.repeat(10000)).length<=851);
  const html=activity.renderSaved([{
    name:'<script>alert(1)</script>',server:'example',status:'done',
    startedAt:100,finishedAt:250,resultPreview:'<b>untrusted</b>'
  }]);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('150ms'));
  assert.equal(html.includes('<script>'),false);
  assert.equal(html.includes('<b>untrusted</b>'),false);
});

test('running tool card only follows the active conversation',()=>{
  const {activity,bubble,switchChat}=buildActivity();
  const steps=[{name:'check',status:'running',startedAt:Date.now()}];
  activity.renderLive({id:'chat-1'},steps);
  assert.equal(bubble.children.length,1);
  assert.ok(bubble.children[0].innerHTML.includes('执行中'));
  const initial=bubble.children[0].innerHTML;
  switchChat('chat-2');
  activity.renderLive({id:'chat-1'},[{name:'check',status:'done'}]);
  assert.equal(bubble.children[0].innerHTML,initial);
});
