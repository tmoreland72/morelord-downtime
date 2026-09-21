import { runInGameTests, assert } from "../../../morelord-core/scripts/testing/in-game.js";
import { NewProjectApp, SessionEditorApp } from "../apps/creation-apps.mjs";
import { RESEARCH_ACTIVITY_ID } from "../activities/research/research-activity.mjs";

export async function runProjectChoiceTests({ onRendered = async () => {} } = {}) {
  return runInGameTests({ checks: [{ id: "downtime.project-choices", async run() {
    const actual = new NewProjectApp();
    let cards, session;
    try {
      await actual.render({ force: true });
      const available = globalThis.MorelordCraftworks?.downtimeIntegration?.isResearchAvailable() === true;
      assert(Boolean(actual.element.querySelector(`[data-activity-id="${RESEARCH_ACTIVITY_ID}"]`)) === available,
        "Research card must match live Drakkenheim availability.");
      await actual.close();
      // Use the real templates and shared CSS with five activity records, even in a world without the pack.
      class FiveCards extends NewProjectApp {
        async _prepareContext(options) { return { ...await super._prepareContext(options), activityTypes: this.constructor.services.activities.list() }; }
      }
      class LongActivities extends SessionEditorApp {
        async _prepareContext(options) { return { ...await super._prepareContext(options), activityTypes: NewProjectApp.services.activities.list().filter(a => a.availableInSessions) }; }
      }
      cards = new FiveCards();
      session = new LongActivities();
      await cards.render({ force: true });
      await session.render({ force: true });
      await new Promise(resolve => setTimeout(resolve, 200));
      for (const width of [900, 620]) {
        cards.setPosition({ width, height: 900 });
        session.setPosition({ width });
        await new Promise(resolve => requestAnimationFrame(resolve));
        const boxes = [...cards.element.querySelectorAll('.ml-downtime-activity-card')].map(el => el.getBoundingClientRect());
        assert(boxes.length === 5, "Odd-card regression needs five cards.");
        assert(boxes.every(box => Math.abs(box.width - boxes[0].width) < 1), "All cards, including the odd last card, must have equal widths.");
        assert(Math.abs(boxes[4].left - boxes[0].left) < 1, "The last card remains in its column.");
        const body = cards.element.querySelector('.ml-app-shell');
        assert(body.scrollWidth <= body.clientWidth + 1, "Card actions must wrap without overflowing.");
        const labels = [...session.element.querySelectorAll('.ml-check-grid > .ml-check')];
        for (const label of labels) {
          assert(label.scrollWidth <= label.clientWidth + 1, "Long activity labels must fit their grid cells.");
          const input = label.querySelector('input'), initial = input.checked;
          label.querySelector('span').click();
          assert(input.checked !== initial, "Clicking the activity label toggles its checkbox exactly once.");
        }
        assert(body.clientHeight > 300, "Project cards must have usable visible height.");
        cards.bringToFront();
        await onRendered(cards, `project-cards-${width}`);
        session.bringToFront();
        await onRendered(session, `session-activities-${width}`);
      }
    } finally { await actual.close(); await cards?.close(); await session?.close(); }
  } }] });
}
