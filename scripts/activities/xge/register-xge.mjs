import { XGE_ACTIVITIES, xgeSummary } from "./xge-rules.mjs";
import { XgeProjectApp } from "../../apps/xge-project-app.mjs";

const ICONS = {
  "religious-service": "fa-solid fa-place-of-worship",
  carousing: "fa-solid fa-mug-hot",
  crime: "fa-solid fa-mask",
  gambling: "fa-solid fa-dice",
  "pit-fighting": "fa-solid fa-hand-fist",
  relaxation: "fa-solid fa-bed",
  "lore-research": "fa-solid fa-book"
};

export function registerXgeActivities(activities, service) {
  for (const [id, activity] of Object.entries(XGE_ACTIVITIES)) {
    activities.register({
      id,
      name: activity.name,
      icon: ICONS[id],
      description: activityDescription(id),
      availableInSessions: activity.presence,
      createProject: data => service.createProject(data, { isGm: globalThis.game?.user?.isGM === true }),
      getSummary: xgeSummary,
      launch: () => new XgeProjectApp({ activityId: id }).render({ force: true }),
      onComplete: project => service.onComplete(project)
    });
  }
}

function activityDescription(id) {
  return {
    "religious-service": "Spend 7 days at a Temple. Religion or Persuasion decides the favor.",
    carousing: "Spend 7 days with named people. The social class sets the cost.",
    crime: "Spend 7 days and 25 gp on a chosen score. Three checks decide the take.",
    gambling: "Stake 10 to 1,000 gp over 7 days. Three checks decide the result.",
    "pit-fighting": "Spend 7 days in the pit. Three checks decide the purse.",
    relaxation: "Spend 7 days at a modest lifestyle. All Exhaustion is removed.",
    "lore-research": "Spend 7 days and 50 gp at a Library. Extra gold can improve the check."
  }[id];
}
