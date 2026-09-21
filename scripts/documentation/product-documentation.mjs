export const DOWNTIME_DOCUMENTATION = Object.freeze({
  id: "morelord-downtime",
  title: "Morelord Downtime",
  subtitle: "Persistent character activity and campaign-time management for the Morelord suite.",
  icon: "fa-solid fa-timer",
  sections: [
    {
      id: "purpose", title: "Purpose", icon: "fa-solid fa-bullseye",
      introduction: "Morelord Downtime gives campaign time a durable structure. It lets players pursue meaningful goals between adventures without forcing those goals to begin and end inside a single game session.",
      paragraphs: [
        "The module is intended for campaigns where training, crafting, commissions, research, recovery, travel-compatible work, and other long-running activities matter. It gives the GM a clear way to announce when downtime is available while allowing each activity to retain its own requirements and outcomes.",
        "Downtime is not a single activity form. Its dashboard is the shared place to see current work, prepare upcoming opportunities, allocate available time, and understand what still needs attention."
      ],
      callouts: [{ tone: "info", icon: "fa-solid fa-link", title: "Designed for continuity", body: "A character goal can span many Downtime Sessions, locations, Journeys, and real-world play sessions without losing its progress." }]
    },
    {
      id: "concepts", title: "Core Concepts", icon: "fa-solid fa-diagram-project",
      introduction: "Downtime separates the activity being pursued from the campaign opportunities used to pursue it.",
      bullets: [
        "Projects are persistent activities, such as learning a language or mastering a weapon. They retain progress until completed or cancelled.",
        "Project and Session details show timestamped history in readable text, including progress, outcomes, changed fields, and referenced names. Existing saved history uses the same display automatically.",
        "Sessions are GM-managed downtime opportunities. They move from Draft to Upcoming to Active, then Finalized or Cancelled.",
        "Available time belongs to an active Session and is tracked separately for each participant.",
        "Allocations spend participant hours from the active Session and apply eligible progress to a Project.",
        "Locations come from the shared Morelord Core registry. Activities can require location capabilities such as an instructor, workshop, library, or forge.",
        "Activity plugins define their own setup, requirements, progress rules, and completion awards while using the same Downtime lifecycle."
      ],
      callouts: [{ tone: "success", icon: "fa-solid fa-arrows-rotate", title: "Sessions organize; Projects persist", body: "Finalizing or cancelling a Session closes its time opportunity. It does not discard unfinished Projects." }]
    },
    {
      id: "gm-workflow", title: "GM Guide", icon: "fa-solid fa-user-shield",
      introduction: "The GM prepares the opportunity and controls when campaign time becomes spendable.",
      steps: [
        { title: "Create a Session", body: "Choose its location, planned hours, participants, and available activity types. Downtime defaults participants from the primary populated Group Actor, then falls back to player-owned characters." },
        { title: "Publish Upcoming", body: "Publishing lets participants review the opportunity, begin allowed activities, and plan persistent Projects before time becomes available." },
        { title: "Start Downtime", body: "Starting the Session makes its planned hours available for participants to allocate." },
        { title: "Resolve and Finalize", body: "Review unallocated hours, waiting decisions, and completion results. Finalize when the opportunity is complete." }
      ],
      callouts: [{ tone: "warning", icon: "fa-solid fa-ban", title: "Cancel instead of delete", body: "Cancelling closes the time opportunity while retaining the Session lifecycle record and all persistent Projects." }]
    },
    {
      id: "player-workflow", title: "Player Guide", icon: "fa-solid fa-user",
      introduction: "Players can create and manage persistent Projects at any time, but can only spend time after the GM starts a Session that permits that activity.",
      steps: [
        { title: "Review the opportunity", body: "Open Downtime to see the published Session, its location, participants, available hours, and permitted activities." },
        { title: "Start or plan a Project", body: "Create and manage Projects whenever needed, or attach an existing persistent Project to an upcoming Session. In New Project, activity cards wrap into additional rows as the window narrows so their action buttons retain single-line labels and spacing." },
        { title: "Allocate time", body: "Once Downtime is active, choose the contributors, enter the hours, and allocate them to the Project." },
        { title: "Continue later", body: "Unfinished Projects stay on the dashboard and can receive eligible time during future Sessions." },
        { title: "Cancel or delete a Project", body: "The GM or Project owner can use Cancel Project or Delete Project in the dashboard, Project details, or activity editor. Cancellation stops progress and keeps the Project under Show Completed. Unused Projects can be deleted immediately; cancel Projects with recorded progress before deleting them. Deletion permanently removes the Project and its history, while Session allocation records remain. Neither action refunds time or gold. Manage Crafting Projects in Craftworks." }
      ]
    },
    {
      id: "training", title: "Training", icon: "fa-solid fa-graduation-cap",
      introduction: "Training always identifies the exact proficiency being learned and the character providing instruction.",
      bullets: [
        "Tools: select the specific proficiency, including artisan, gaming, musical, and thieves’ tools.",
        "Skills and armor: select the specific skill, armor category, shield, or individual armor proficiency.",
        "Languages: select the specific language.",
        "Estimates appear after selection. Languages and tools use (10 minus positive Intelligence modifier) workweeks of 40 hours, with a one-workweek floor. Other proficiencies and masteries use that baseline as GM-defined guidance. The GM may adjust estimates; existing saved durations are preserved.",
        "Weapon proficiencies: select the specific weapon.",
        "Weapon masteries: select the specific weapon mastery.",
        "The student and instructor must be different characters; character instructors contribute the same training hours as the student.",
        "Character instructors can only offer proficiencies and masteries they already know.",
        "An NPC instructor records a reminder name and can optionally bind the Project to the Location where that instructor is available."
      ],
      callouts: [{ tone: "success", icon: "fa-solid fa-award", title: "Completion award", body: "When training completes, Downtime applies the specific D&D 5e proficiency to the student Actor and records the outcome." }]
    },
    {
      id: "commission", title: "Commissions", icon: "fa-solid fa-handshake",
      introduction: "A Commission tracks work performed by a contractor as campaign days pass.",
      bullets: [
        "Record the contractor, their Location, the commissioned item, total labor days, and payment or material notes.",
        "Select Item searches enabled compendiums through Core and retains the item UUID. Editable estimates use rarity or mundane list price; scrolls and artifacts need a manual estimate. Selecting an item does not automatically purchase, craft, or deliver it.",
        "Commissions do not consume Downtime Session hours and cannot be planned into a Session.",
        "Each authoritative new-day event advances active Commission work by one day.",
        "After the final labor day, the Commission waits for collection at the contractor's Location."
      ]
    },
    {
      id: "source-item", title: "Source Item", icon: "fa-solid fa-magnifying-glass-dollar",
      introduction: "Source Item spends gold and campaign weeks searching for a magic item saved on the character's Marketplace wishlist.",
      bullets: [
        "Choose an available Common through Legendary magic item from the Project owner's Marketplace wishlist, a Location, and either Arcana or Investigation.",
        "The minimum investment is 100 gp and one week. Each additional 250 gp and each additional week adds +2 to the hidden check.",
        "The rarity DC is Common 10, Uncommon 15, Rare 20, Very Rare 25, or Legendary 30. The selected skill is rolled automatically and kept hidden until the Project completes. Guidance and the Help action do not apply.",
        "The result and randomized offer price are revealed after the final day. On failure, Marketplace selects 1d4 alternative magic items of the same or lower rarity.",
        "After resolution, the owner may attempt one raw Persuasion check. Its total may raise or lower every offer price by as much as 25 percent."
      ],
      callouts: [{ tone: "warning", icon: "fa-solid fa-coins", title: "Investment is spent immediately", body: "Starting the Project deducts the committed gold through Marketplace. It pays vendor and contractor fees and is not refunded if the requested item is not found. Later edits may add investment or weeks, but cannot reduce or redirect what was already committed." }]
    },
    {
      id: "research", title: "Research Drakkenheim Recipes", icon: "fa-solid fa-book-open",
      paragraphs: [
        "Start a Research Drakkenheim Recipes Project, choose a researcher and a monster component from their own or party Group inventory, then allocate one hour in a Session that permits research. The component must remain available; it is not consumed and no skill check is required.",
        "Research uses the Recipes browser's component-family and recipe-rarity filters. Completion saves up to five distinct random matches, or all matches when fewer than five exist, and marks them known for all player characters. Completion stays in Downtime; View Recipe opens a saved result in the Craftworks Recipes browser. Crafting still requires the recipe's exact ingredients.",
        "Research appears in activity choices only with an enabled, accessible Drakkenheim content pack in Craftworks. Existing Projects, results, and saved Session choices are retained if access becomes unavailable."
      ]
    },
    {
      id: "suite", title: "Morelord Suite Integration", icon: "fa-solid fa-puzzle-piece",
      paragraphs: [
        "Manage Locations opens the suite-wide Core location manager. Sessions use those shared locations, and activity requirements evaluate the same capability records used by other Morelord modules.",
        "Crafting is a read-through activity plugin. Marked recipes that are ready to craft and jobs already in progress appear as active Downtime Projects; opening one launches Craftworks with its crafter selected. Recipes, materials, checks, jobs, and outputs remain authoritative in Craftworks.",
        "Marketplace owns Source Item wishlist choices, random same-or-lower-rarity alternatives, and character currency mutation. Downtime owns the elapsed Project, hidden result, and final offer record.",
        "Journeys can advance elapsed downtime days automatically. A GM can also use Advance Day below the GM Operations heading divider, above the status cards, when the campaign is not using Journeys. Craftworks and Marketplace can register compatible activities and providers. Authoritative allocations, planning, and player cancellations are resolved by the primary active GM."
      ]
    }
  ]
});
