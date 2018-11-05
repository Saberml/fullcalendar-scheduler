import { DateProfile, DateMarker, wholeDivideDurations, isInt, Component, ComponentContext } from 'fullcalendar'
import HeaderBodyLayout from './HeaderBodyLayout'
import TimelineHeader from './TimelineHeader'
import TimelineSlats from './TimelineSlats'
import { TimelineDateProfile, buildTimelineDateProfile } from './timeline-date-profile'

export interface TimeAxisProps {
  dateProfile: DateProfile
}

export default class TimeAxis extends Component<TimeAxisProps> {

  // child components
  layout: HeaderBodyLayout
  header: TimelineHeader
  slats: TimelineSlats

  // internal state
  tDateProfile: TimelineDateProfile

  constructor(context: ComponentContext, headerContainerEl, bodyContainerEl) {
    super(context)

    let layout = this.layout = new HeaderBodyLayout(
      headerContainerEl,
      bodyContainerEl,
      'auto'
    )

    this.header = new TimelineHeader(
      context,
      layout.headerScroller.enhancedScroll.canvas.contentEl
    )

    this.slats = new TimelineSlats(
      context,
      layout.bodyScroller.enhancedScroll.canvas.bgEl
    )
  }

  destroy() {
    this.layout.destroy()
    this.header.destroy()
    this.slats.destroy()

    super.destroy()
  }

  render(props: TimeAxisProps) {
    let tDateProfile = this.tDateProfile =
      buildTimelineDateProfile(props.dateProfile, this.view) // TODO: cache

    this.header.receiveProps({
      dateProfile: props.dateProfile,
      tDateProfile
    })

    this.slats.receiveProps({
      dateProfile: props.dateProfile,
      tDateProfile
    })
  }

  updateSize(totalHeight, isAuto, isResize) {
    this.header.updateSize(totalHeight, isAuto, isResize)
    this.layout.setHeight(totalHeight, isAuto)

    this.applySlotWidth(
      this.computeSlotWidth()
    )

    this.slats.updateSize()
  }

  computeSlotWidth() {
    let slotWidth = this.opt('slotWidth') || ''

    if (slotWidth === '') {
      slotWidth = this.computeDefaultSlotWidth(this.tDateProfile)
    }

    return slotWidth
  }

  computeDefaultSlotWidth(tDateProfile) {
    let maxInnerWidth = 0 // TODO: harness core's `matchCellWidths` for this

    this.header.innerEls.forEach(function(innerEl, i) {
      maxInnerWidth = Math.max(maxInnerWidth, innerEl.offsetWidth)
    })

    let headerWidth = maxInnerWidth + 1 // assume no padding, and one pixel border

    // in TimelineView.defaults we ensured that labelInterval is an interval of slotDuration
    // TODO: rename labelDuration?
    let slotsPerLabel = wholeDivideDurations(tDateProfile.labelInterval, tDateProfile.slotDuration)

    let slotWidth = Math.ceil(headerWidth / slotsPerLabel)

    let minWidth: any = window.getComputedStyle(this.header.slatColEls[0]).minWidth
    if (minWidth) {
      minWidth = parseInt(minWidth, 10)
      if (minWidth) {
        slotWidth = Math.max(slotWidth, minWidth)
      }
    }

    return slotWidth
  }

  applySlotWidth(slotWidth: number | string) {
    let { layout, tDateProfile } = this
    let containerWidth: number | string = ''
    let containerMinWidth: number | string = ''
    let nonLastSlotWidth: number | string = ''

    if (slotWidth !== '') {
      slotWidth = Math.round(slotWidth as number)

      containerWidth = slotWidth * tDateProfile.slotDates.length
      containerMinWidth = ''
      nonLastSlotWidth = slotWidth

      let availableWidth = layout.bodyScroller.enhancedScroll.getClientWidth()

      if (availableWidth > containerWidth) {
        containerMinWidth = availableWidth
        containerWidth = ''
        nonLastSlotWidth = Math.floor(availableWidth / tDateProfile.slotDates.length)
      }
    }

    layout.headerScroller.enhancedScroll.canvas.setWidth(containerWidth)
    layout.headerScroller.enhancedScroll.canvas.setMinWidth(containerMinWidth)
    layout.bodyScroller.enhancedScroll.canvas.setWidth(containerWidth)
    layout.bodyScroller.enhancedScroll.canvas.setMinWidth(containerMinWidth)

    if (nonLastSlotWidth !== '') {
      this.header.slatColEls.slice(0, -1).concat(
        this.slats.slatColEls.slice(0, -1)
      ).forEach(function(el) {
        el.style.width = nonLastSlotWidth + 'px'
      })
    }
  }


  // returned value is between 0 and the number of snaps
  computeDateSnapCoverage(date: DateMarker): number {
    let { dateEnv, tDateProfile } = this
    let snapDiff = dateEnv.countDurationsBetween(
      tDateProfile.normalizedStart,
      date,
      tDateProfile.snapDuration
    )

    if (snapDiff < 0) {
      return 0
    } else if (snapDiff >= tDateProfile.snapDiffToIndex.length) {
      return tDateProfile.snapCnt
    } else {
      let snapDiffInt = Math.floor(snapDiff)
      let snapCoverage = tDateProfile.snapDiffToIndex[snapDiffInt]

      if (isInt(snapCoverage)) { // not an in-between value
        snapCoverage += snapDiff - snapDiffInt // add the remainder
      } else {
        // a fractional value, meaning the date is not visible
        // always round up in this case. works for start AND end dates in a range.
        snapCoverage = Math.ceil(snapCoverage)
      }

      return snapCoverage
    }
  }

  // for LTR, results range from 0 to width of area
  // for RTL, results range from negative width of area to 0
  dateToCoord(date) {
    let { tDateProfile } = this
    let snapCoverage = this.computeDateSnapCoverage(date)
    let slotCoverage = snapCoverage / tDateProfile.snapsPerSlot
    let slotIndex = Math.floor(slotCoverage)
    slotIndex = Math.min(slotIndex, tDateProfile.slotCnt - 1)
    let partial = slotCoverage - slotIndex
    let coordCache = this.slats.innerCoordCache

    if (this.isRtl) {
      return (
        coordCache.rights[slotIndex] -
        (coordCache.getWidth(slotIndex) * partial)
      ) - coordCache.originClientRect.width
    } else {
      return (
        coordCache.lefts[slotIndex] +
        (coordCache.getWidth(slotIndex) * partial)
      )
    }
  }

  rangeToCoords(range) {
    if (this.isRtl) {
      return { right: this.dateToCoord(range.start), left: this.dateToCoord(range.end) }
    } else {
      return { left: this.dateToCoord(range.start), right: this.dateToCoord(range.end) }
    }
  }

}