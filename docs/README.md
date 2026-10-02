# Outrun documentation

## How to use these documents

[Product](product.md) is the general description of the app, based on the founding product brief. It describes both the first release and the future platform. [MVP](mvp.md) defines the implementation boundary for the first release.

The other documents turn that brief into a proposed technical and product design. Proposed behavior is explicitly marked where the brief leaves a choice open. No document implies that a component is already implemented or deployed.

If documents disagree, resolve the disagreement and update both documents before implementing the affected behavior. Product intent belongs in `product.md`; release scope belongs in `mvp.md`; detailed system behavior belongs in the relevant design document.

## Reading order

1. [Product description](product.md)
2. [MVP scope and acceptance criteria](mvp.md)
3. [Architecture](architecture.md)
4. [Data model](data-model.md)
5. [Game engine](game-engine.md)
6. [Realtime](realtime.md), [location](location.md), and [capture](capture.md)
7. [Mobile experience](mobile-experience.md)
8. [Security](security.md), [privacy](privacy.md), and [safety](safety.md)
9. [Current phase and open decisions](current-phase.md)

## Document map

| Document | Owns |
| --- | --- |
| [Product](product.md) | Vision, audiences, principles, full feature direction |
| [MVP](mvp.md) | Included/excluded scope, release journeys, acceptance criteria |
| [Architecture](architecture.md) | Components, package boundaries, deployment proposal |
| [Game engine](game-engine.md) | Definitions, commands, events, transitions, win conditions |
| [Data model](data-model.md) | Vocabulary, entity relationships, persistence proposal |
| [Realtime](realtime.md) | Protocol, timers, reconnects, synchronization |
| [Location](location.md) | Collection, quality, projections, boundaries |
| [Capture](capture.md) | Evidence, validation, disputes, finalization |
| [Mobile experience](mobile-experience.md) | Screens and interaction requirements |
| [Security](security.md) | Authentication, authorization, validation, media access |
| [Privacy](privacy.md) | Data lifecycle, disclosure, retention, user controls |
| [Safety](safety.md) | Outdoor safety and host responsibilities |
| [Current phase](current-phase.md) | Milestones, outstanding choices, implementation status |
