import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
function mount(status='completed', storage=new Map(), members=[]) {
  const state={revision:1,members,runs:[{id:'task',status,task:'task',members:members.length?members:[{id:'m',name:'Member',provider:'p',model:'m',status}],messages:[]}]};
  let definition, pane, index=0, hooks=[];
  const R={createElement:(type,props,...children)=>({type,props:props||{},children}),
    useState(initial){const i=index++;if(!(i in hooks))hooks[i]=i===0?state:i===1&&members.length?members:typeof initial==='function'?initial():initial;return [hooks[i],v=>{hooks[i]=typeof v==='function'?v(hooks[i]):v;}];},
    useRef(initial){const i=index++;return hooks[i] ||= {current:initial};},useEffect(){},useLayoutEffect(){}};
  vm.runInNewContext(readFileSync(new URL('../lib/client.js',import.meta.url),'utf8'),{
    window:{__ModuleLoader__:{load:d=>definition=d}},document:{querySelector:()=>true},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},AbortSignal,Date,Set,JSON
  });
  const plugin=definition.factory(()=>R);
  const ctx={get(){},inject(){},effect(){},slots:{inject:(_name,fn)=>fn(),register:(options,component)=>{if(options.name==='sidebar.right.pane.tab')pane=component;}}};
  plugin.apply(ctx);
  return {state,storage,render(){index=0;const wrapper=pane({sessionId:'lead'});return wrapper.type(wrapper.props);}};
}
function nodes(tree,predicate,result=[]) {
  if(!tree||typeof tree!=='object')return result;
  if(predicate(tree))result.push(tree);
  for(const child of tree.children||[])if(Array.isArray(child))child.forEach(c=>nodes(c,predicate,result));else nodes(child,predicate,result);
  return result;
}
const button=(tree,text)=>nodes(tree,n=>n.type==='button'&&n.children.includes(text))[0];
const summary=tree=>nodes(tree,n=>n.props.className==='tc2-note tc2-memberStatus');
test('completed task summary is hidden by default and can be opened and closed',()=>{
  const app=mount();let tree=app.render();assert.equal(summary(tree).length,0);
  button(tree,'显示成员状态').props.onClick();tree=app.render();assert.equal(summary(tree).length,1);
  nodes(tree,n=>n.props['aria-label']==='关闭成员状态')[0].props.onClick();tree=app.render();assert.equal(summary(tree).length,0);
  assert.ok(button(tree,'显示成员状态'));
});
test('manual close survives re-render and remount; active task defaults to visible',()=>{
  const app=mount('running');let tree=app.render();assert.equal(summary(tree).length,1);
  button(tree,'收起成员状态').props.onClick();assert.equal(summary(app.render()).length,0);
  const reopened=mount('running',app.storage);assert.equal(summary(reopened.render()).length,0);
  button(reopened.render(),'显示成员状态').props.onClick();assert.equal(summary(reopened.render()).length,1);
});
test('automatic summary collapses when active task completes',()=>{
  const app=mount('running');assert.equal(summary(app.render()).length,1);
  app.state.runs[0].status='completed';assert.equal(summary(app.render()).length,0);
});
test('full configured roster renders numbered member cards and four distinct bubble colors',()=>{
  const members=Array.from({length:4},(_,i)=>({id:'member-'+i,name:'Member '+i,provider:'p',model:'m',duty:'task',stage:1,status:'completed'}));
  const app=mount('completed',new Map(),members);
  app.state.runs[0].messages=members.map((m,i)=>({id:'message-'+i,kind:'assistant',memberId:m.id,speaker:m.name,text:'hello',time:0}));
  let tree=app.render();
  const cards=nodes(tree,n=>n.props.className==='tc2-card');assert.equal(cards.length,4);
  for(let i=0;i<4;i++)assert.equal(nodes(cards[i],n=>n.children.includes('固定成员 '+(i+1))).length,1);
  const bubbles=nodes(tree,n=>n.props.className==='tc2-message');
  assert.equal(new Set(bubbles.map(n=>n.props.style['--bubble-bg'])).size,4);
  const previous=Object.fromEntries(bubbles.map(n=>[n.props.key,n.props.style['--bubble-bg']]));
  app.state.runs[0].members=[...members].reverse();tree=app.render();
  for(const n of nodes(tree,n=>n.props.className==='tc2-message'))assert.equal(n.props.style['--bubble-bg'],previous[n.props.key]);
});
