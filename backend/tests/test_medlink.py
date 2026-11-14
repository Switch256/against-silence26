from datetime import datetime, timedelta, timezone

from app import medlink
from app.aegis import evaluate
from app.models import Reading, Severity
from app.pulsebrief import build

T0 = datetime(2026, 11, 14, 12, 0, tzinfo=timezone.utc)


def brief(hr=110, start=0):
    history = [Reading(ts=T0 + timedelta(seconds=start + i), heart_rate=72 + (i % 5) - 2) for i in range(120)]
    spike = Reading(ts=T0 + timedelta(seconds=start + 120), heart_rate=hr)
    alert = evaluate(spike, history)
    return build(alert, history + [spike]), alert.severity


def test_delivers_immediately_when_link_is_up(db):
    inbox = medlink.EarthInbox(db)
    layers, sev = brief()
    medlink.enqueue(db, layers, sev)
    sent = medlink.flush(db, inbox)
    assert len(sent) == 3
    assert set(medlink.earth_briefs(db)[0]["layers"]) == {"headline", "context", "evidence"}


def test_blackout_keeps_everything_queued(db):
    inbox = medlink.EarthInbox(db)
    medlink.set_link(db, inbox, "down")
    layers, sev = brief()
    medlink.enqueue(db, layers, sev)
    assert medlink.flush(db, inbox) == []
    assert len(medlink.outbox(db, "queued")) == 3
    assert medlink.earth_briefs(db) == []


def test_short_window_lets_only_the_headline_through(db):
    inbox = medlink.EarthInbox(db)
    medlink.set_link(db, inbox, "down")
    layers, sev = brief()
    medlink.enqueue(db, layers, sev)
    sent = medlink.open_window(db, inbox, budget_bytes=250)
    assert [s.split(":")[1] for s in sent] == ["headline"]
    assert medlink.link(db)["state"] == "down"
    assert set(medlink.earth_briefs(db)[0]["layers"]) == {"headline"}


def test_restoring_the_link_delivers_the_rest_nothing_lost(db):
    inbox = medlink.EarthInbox(db)
    medlink.set_link(db, inbox, "down")
    layers, sev = brief()
    medlink.enqueue(db, layers, sev)
    medlink.open_window(db, inbox, budget_bytes=250)
    sent = medlink.set_link(db, inbox, "up")
    assert [s.split(":")[1] for s in sent] == ["context", "evidence"]
    assert medlink.outbox(db, "queued") == []
    assert medlink.link(db)["bytes_sent"] == sum(len(l.encode()) for l in layers)


def test_headlines_of_all_briefs_go_before_any_context_urgent_first(db):
    inbox = medlink.EarthInbox(db)
    medlink.set_link(db, inbox, "down")
    review, sev_r = brief(hr=84)
    urgent, sev_u = brief(hr=120, start=1000)
    assert (sev_r, sev_u) == (Severity.review, Severity.urgent)
    medlink.enqueue(db, review, sev_r)
    medlink.enqueue(db, urgent, sev_u)
    order = [(b["layer"], b["severity"]) for b in medlink.outbox(db, "queued")]
    assert order[:2] == [("headline", "urgent"), ("headline", "review")]
    assert order[2][0] == "context"


def test_duplicate_delivery_is_ignored_by_earth(db):
    inbox = medlink.EarthInbox(db)
    assert inbox.deliver("pb-x:headline", "pb-x", "headline", b'{"id":"pb-x"}')
    assert inbox.deliver("pb-x:headline", "pb-x", "headline", b'{"id":"pb-x"}')
    assert len(medlink.earth_briefs(db)) == 1


def test_queued_context_can_be_refreshed_but_not_after_it_left(db):
    inbox = medlink.EarthInbox(db)
    medlink.set_link(db, inbox, "down")
    layers, sev = brief()
    brief_id = medlink.enqueue(db, layers, sev)
    layers[1].payload["done"] = ["Drink water"]
    assert medlink.update_layer(db, brief_id, layers[1]) is True
    medlink.set_link(db, inbox, "up")
    assert medlink.earth_briefs(db)[0]["layers"]["context"]["done"] == ["Drink water"]
    assert medlink.update_layer(db, brief_id, layers[1]) is False


def test_outbox_survives_a_restart(db, pool):
    from app.db import open_pool
    import os
    inbox = medlink.EarthInbox(db)
    medlink.set_link(db, inbox, "down")
    layers, sev = brief()
    medlink.enqueue(db, layers, sev)
    fresh = open_pool(os.environ["TEST_DATABASE_URL"])      # a new process would reconnect like this
    try:
        assert len(medlink.outbox(fresh, "queued")) == 3
    finally:
        fresh.close()


def test_replies_wait_for_the_link_then_arrive(db):
    inbox = medlink.EarthInbox(db)
    medlink.set_link(db, inbox, "down")
    rid = medlink.reply(db, inbox, "pb-1", "Rest 15 minutes, re-measure, report back.")
    assert medlink.replies(db, "queued")[0]["reply_id"] == rid
    medlink.set_link(db, inbox, "up")
    assert medlink.replies(db, "delivered")[0]["reply_id"] == rid
