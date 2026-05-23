# Beacon Engineering Principles

1. **Jedes Package hat Tests.** Keine Ausnahmen.
2. **Security Checks vor teuren Operationen.** Auth + Plan-Check vor Scan/Fix/Report.
3. **DB-Änderungen via Migrations.** Kein manuelles DDL.
4. **Deutsche UI, englischer Code.** Kommentare auf Englisch.
5. **Scanner Checks sind pure Functions.** CheckContext rein → ScanCheck raus.
6. **AI-Output wird validiert.** Nie ungefiltert an User ausliefern.
7. **Plan-Limits atomar in der DB enforced.** Nicht im Application Code.
8. **Async by default.** Alles was >1s dauert geht in die Queue.
9. **No shadcn, no Radix.** Eigene Components die wir verstehen.
10. **ADRs für jede Architektur-Entscheidung.** Kontext > Entscheidung.
