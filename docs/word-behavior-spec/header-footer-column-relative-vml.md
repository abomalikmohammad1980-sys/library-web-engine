# Column-relative VML in header/footer stories

## Confirmed case

VML shapes in a header/footer commonly use
`mso-position-horizontal-relative:text`.  The model normalizes this to
`posHRel="column"`.  Its `left`/`margin-left` offset is relative to the text
column, not the physical page edge.

## Evidence

Microsoft Word COM on `سيرة الشيخ أبي أنس الشامي - أبو حمزة المهاجر.docx`
reports both margin images with `RelativeHorizontalPosition=2` (column):

- header: left `-0.55pt`, width `537.75pt`, wrap type `5` (behind text);
- footer: left `0.30pt`, width `537.75pt`, wrap type `5` (behind text).

The section left margin is `567twips` (`28.35pt`).  OOXML/model preserve
offsets `-11twips` and `+6twips`, so the physical scene positions must be
`556twips` and `573twips`.  The old scene positions were `-11` and `6`, shifted
left by the full margin.

## Rule

For header/footer margin-anchor placement, both `margin` and `column` horizontal
references add the physical left text margin before applying the stored offset.
`page` remains page-relative.  This rule does not alter vertical placement:
the same corpus confirms paragraph-relative y uses header/footer distance.

Both images remain `behindDoc`; therefore they paint below story/body text and
do not enlarge body clearance.

## Regression

The Shami scene corpus test asserts exact header/footer x/y/width values,
`behindDoc=true`, cover isolation, and sequential PAGE values.
