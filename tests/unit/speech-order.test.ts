import { expect, it } from 'vitest';
import { createSave } from '../../src/core';
import { orderSpeechIds } from '../../src/platform/speechOrder';

it('prioritises interface, current-area story, pals, unfluent questions and answers, then everything else', () => {
  const save = createSave(); save.map.area = 2;
  Object.assign(save.facts['add:1+1']!, { stage: 'review', fastDays: ['1', '2', '3'] });
  const ids = ['fact-add-1-1', 'story-welcome-0', 'answer-add-2-2', 'muddle-domi', 'story-den-0', 'ui-play',
    'fact-add-2-2', 'name-twoot', 'area-twinFalls', 'tap-7', 'story-falls-0', 'answer-add-1-1', 'unknown'];
  const original = [...ids];
  expect(orderSpeechIds(ids, save)).toEqual(['ui-play', 'area-twinFalls', 'tap-7', 'story-den-0', 'story-falls-0',
    'muddle-domi', 'name-twoot', 'answer-add-2-2', 'fact-add-2-2', 'fact-add-1-1', 'story-welcome-0', 'answer-add-1-1', 'unknown']);
  expect(ids).toEqual(original);
  save.map.area = 1;
  expect(orderSpeechIds(['story-den-0', 'story-welcome-0'], save)).toEqual(['story-welcome-0', 'story-den-0']);
});
