import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadOrCreateKeys, encryptBox, decryptBox } from '../crypto.js'
import { normalizeSite, checkSite, getToken, fetchStudent } from '../moodle.js'
import { parseIcal, icalDate, fetchIcal } from '../ical.js'

test('normalizeSite', () => {
  assert.equal(normalizeSite('https://moodle.alaqsa.edu.ps/login/index.php'), 'https://moodle.alaqsa.edu.ps')
  assert.equal(normalizeSite('moodle.x.edu/my/'), 'https://moodle.x.edu')
  assert.equal(normalizeSite('https://x.edu/moodle/course/view.php?id=3'), 'https://x.edu/moodle')
})

test('crypto roundtrip', () => {
  const k = loadOrCreateKeys(join(mkdtempSync(join(tmpdir(), 'mk-')), 'key.pem'))
  const long = 'https://moodle.x.edu/calendar/export_execute.php?userid=1234567&authtoken=' + 'a'.repeat(40) + '&preset_what=all&preset_time=recentupcoming'
  const box = encryptBox({ password: 'سر123!', ical: long }, k.publicSpki)
  assert.deepEqual(decryptBox(box, k.privateKey), { password: 'سر123!', ical: long })
})

test('ical parse', () => {
  const ics = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:55@moodle.x\r\nSUMMARY:Report 1 is due\r\nCATEGORIES:CS101\r\nDTSTART:20261124T215900Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'
  const ev = parseIcal(ics)
  assert.equal(ev.length, 1)
  assert.equal(icalDate(ev[0].DTSTART), Date.UTC(2026, 10, 24, 21, 59, 0))
})

// خادم مودل وهمي
function fakeMoodle() {
  const calls = []
  const srv = createServer(async (req, res) => {
    let body = ''
    for await (const c of req) body += c
    const u = new URL(req.url, 'http://x')
    const f = Object.fromEntries(new URLSearchParams(body))
    calls.push({ path: u.pathname, f })
    const send = (o) => (res.setHeader('Content-Type', 'application/json'), res.end(JSON.stringify(o)))
    if (u.pathname.startsWith('/cf')) return (res.statusCode = 403), res.end('<!DOCTYPE html><html><head><title>Just a moment...</title></head></html>')
    if (u.pathname === '/lib/ajax/service-nologin.php') return send([{ error: false, data: { sitename: 'Fake U', typeoflogin: 1, wwwroot: `http://127.0.0.1:${srv.address().port}` } }])
    if (u.pathname === '/login/token.php') return f.password === 'good' ? send({ token: 'T1' }) : send({ error: 'Invalid login', errorcode: 'invalidlogin' })
    if (u.pathname === '/calendar/export_execute.php')
      return res.end('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:9@x\nSUMMARY:Lab is due\nDTSTART:20991124T215900Z\nEND:VEVENT\nBEGIN:VEVENT\nUID:10@x\nSUMMARY:Assignment 2 مستحق\nDTSTART:20991125T215900Z\nEND:VEVENT\nEND:VCALENDAR\n')
    if (f.wstoken !== 'T1') return send({ exception: 'x', errorcode: 'invalidtoken', message: 'bad' })
    const fut = Math.floor(Date.now() / 1000) + 86400
    switch (f.wsfunction) {
      case 'core_webservice_get_site_info':
        return send({ userid: 7, fullname: 'Ahmad', sitename: 'Fake U', functions: [] })
      case 'core_enrol_get_users_courses':
        return send([{ id: 3, fullname: 'Math', visible: 1, enddate: 0 }])
      case 'core_course_get_contents':
        return send([{ name: 'W1', modules: [
          { id: 11, name: 'HW1', modname: 'assign', url: 'u/11', dates: [] },
          { id: 12, name: 'Slides', modname: 'resource', url: 'u/12' },
          { id: 13, name: 'lbl', modname: 'label' },
        ] }])
      case 'mod_assign_get_assignments':
        return send({ courses: [{ id: 3, assignments: [{ id: 100, cmid: 11, name: 'HW1', duedate: fut }] }] })
      case 'mod_quiz_get_quizzes_by_courses':
        return send({ quizzes: [{ id: 200, coursemodule: 14, course: 3, name: 'Quiz 1', timeclose: fut, timelimit: 1800 }] })
      case 'core_calendar_get_action_events_by_timesort':
        return send({ events: [] })
      case 'mod_assign_get_submission_status':
        return send({ lastattempt: { submission: { status: 'new' } } })
      case 'mod_quiz_get_user_attempts':
        return send({ attempts: [{ id: 1 }] })
    }
    send({ exception: 'x', errorcode: 'nofunc', message: f.wsfunction })
  })
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ srv, calls, base: `http://127.0.0.1:${srv.address().port}` })))
}

test('moodle flow against fake server', async () => {
  const { srv, base, calls } = await fakeMoodle()
  try {
    const site = await checkSite(base + '/login/index.php')
    assert.equal(site.loginType, 'app')
    assert.equal(site.siteName, 'Fake U')
    await assert.rejects(getToken(site.base, '123', 'bad'), /غلط/)
    const token = await getToken(site.base, '123', 'good')
    assert.equal(token, 'T1')
    assert.ok(calls.some((c) => c.f.service === 'moodle_mobile_app'))

    const r = await fetchStudent(site.base, token)
    const by = Object.fromEntries(r.items.map((i) => [i.key, i]))
    assert.equal(r.user.fullname, 'Ahmad')
    assert.ok(by['assign-11'].due > Date.now())
    assert.equal(by['assign-11'].submitted, false)
    assert.equal(by['quiz-14'].submitted, true)
    assert.equal(by['quiz-14'].timeLimitMin, 30)
    assert.ok(by['resource-12'])
    assert.ok(!by['label-13'])

    await assert.rejects(fetchStudent(site.base, 'expired'), (e) => e.code === 'invalidtoken')

    const ic = await fetchIcal(base + '/calendar/export_execute.php?userid=7&authtoken=abc')
    assert.equal(ic.items[0].title, 'Lab')
    assert.equal(ic.items[1].title, 'Assignment 2')
    assert.equal(ic.items[1].kind, 'assign')
    assert.equal(ic.items[0].kind, 'assign')
    await assert.rejects(fetchIcal(base + '/cf/export_execute.php?authtoken=x'), (e) => e.code === 'blocked')
  } finally {
    srv.close()
  }
})
