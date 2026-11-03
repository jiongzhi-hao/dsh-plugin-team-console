import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, applyPreset, memberName } from '../lib/presets.js';
import { defaults, validateMembers } from '../lib/manager.js';

const ORDINALS = ['大娃', '二娃', '三娃', '四娃', '五娃', '六娃', '七娃', '八娃', '九娃', '十娃'];

test('memberName 遵循「职责之大娃/二娃/三娃…」约定', () => {
  assert.equal(memberName('用户与流程设计', 0), '用户与流程设计之大娃');
  assert.equal(memberName('数据与实现约束', 1), '数据与实现约束之二娃');
  assert.equal(memberName('独立评审', 2), '独立评审之三娃');
  assert.equal(memberName('方案定稿', 3), '方案定稿之四娃');
  assert.equal(memberName('第五位', 4), '第五位之五娃');
  assert.equal(memberName('兜底', 12), '兜底之13娃');
});

test('六套预设的每个成员名都由职责派生且带序号', () => {
  for (const preset of PRESETS) {
    const { members } = applyPreset(preset.id, []);
    assert.equal(members.length, preset.roles.length, preset.id);
    members.forEach((m, i) => {
      const expected = `${preset.roles[i].title}之${ORDINALS[i]}`;
      assert.equal(m.name, expected, `${preset.id}#${i}`);
      assert.ok(m.name.endsWith(ORDINALS[i]), '必须以序号结尾');
      assert.ok(m.name.startsWith(preset.roles[i].title), '必须以职责开头');
      assert.ok(m.name.length <= 24, `名称超长：${m.name}`);
      assert.equal(m.stage, preset.roles[i].stage);
      assert.match(m.duty, new RegExp(`^【${preset.roles[i].title}】`));
    });
  }
});

test('重复套用预设会覆盖旧名，不再残留历史名称', () => {
  const stale = [{ id: 'a', name: '协调汇总之大娃', provider: 'p', model: 'm' },
                 { id: 'b', name: '调研分析之二娃', provider: 'p', model: 'm' }];
  const { members } = applyPreset('lean_review', stale);
  assert.deepEqual(members.map(m => m.name), ['方案负责人之大娃', '独立复核之二娃']);
  assert.deepEqual(members.map(m => m.id), ['a', 'b'], 'ID 必须保留');
});

test('预设产出的成员可直接通过校验（名称唯一、模型已选）', () => {
  for (const preset of PRESETS) {
    const { members } = applyPreset(preset.id, []);
    const withModel = members.map(m => ({ ...m, provider: 'token-switch', model: 'neolink/deepseek-v4.1-flash' }));
    const clean = validateMembers(withModel);
    assert.equal(clean.length, members.length, preset.id);
    const names = clean.map(m => m.name);
    assert.equal(new Set(names).size, names.length, `${preset.id} 名称重复`);
  }
});

test('内置默认成员同样使用该命名约定', () => {
  const names = defaults().map(m => m.name);
  assert.deepEqual(names, ['协调汇总之大娃', '调研分析之二娃', '方案执行之三娃', '审查核验之四娃']);
});
