import React from 'react';
import { ScrollView, Text } from 'react-native';
import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { FastScrollSectionTab, Section } from '../../index';
import { isHostNode, TestNode } from '../../__fixtures__/testNode';

type SectionLabel = Exclude<Section['text'], string>;

/** A tab label that says whether its tab is the active one. */
const activeAwareLabel = (name: string): SectionLabel =>
  function ActiveAwareLabel({ isActive }) {
    return <Text>{isActive ? `${name} (active)` : name}</Text>;
  };

const SECTIONS: Section[] = [
  { index: 0, text: 'Fruits' },
  { index: 5, text: 'Vegetables' },
  { index: 12, text: 'Dairy' },
];

const ACTIVE_TEXT_STYLE = { color: 'red' };

const renderTabs = (sections: Section[] = SECTIONS) => {
  const ref = React.createRef<React.ElementRef<typeof FastScrollSectionTab>>();
  const onScrollToIndex = jest.fn();
  render(
    <FastScrollSectionTab
      ref={ref}
      stickyHeaderIndicesWithData={sections}
      onScrollToIndex={onScrollToIndex}
      tabBarActiveItemTextStyle={ACTIVE_TEXT_STYLE}
    />
  );

  const showListItem = (index: number) =>
    act(() => ref.current?.onViewableIndexChanged(index));

  return { onScrollToIndex, showListItem };
};

/**
 * The tab bar's ScrollView. The tab bar exposes no other handle, so this is
 * the documented `UNSAFE_*` exception (docs/unit-testing.md -> Mocks the RN
 * preset already provides).
 */
const getTabBarScrollView = () => screen.UNSAFE_getByType(ScrollView);

/** The tab bar's `scrollTo`, which RN's Jest preset mocks on every ScrollView. */
const getTabBarScrollTo = (): jest.Mock =>
  getTabBarScrollView().instance.scrollTo;

/**
 * Lays the tab bar out the way the native layout pass would: `visibleWidth` of
 * it on screen, holding a row of tabs that are each `tabWidth` wide.
 */
const layoutTabBar = ({
  visibleWidth,
  tabWidth,
}: {
  visibleWidth: number;
  tabWidth: number;
}) => {
  const layout = (x: number, width: number) => ({
    nativeEvent: { layout: { x, y: 0, width, height: 40 } },
  });
  // Inside the ScrollView, the row of tabs measures itself, then each tab.
  const [row, ...tabs]: TestNode[] = getTabBarScrollView().findAll(
    (node: TestNode) => isHostNode(node) && node.props.onLayout
  );

  fireEvent(screen.root, 'layout', layout(0, visibleWidth));
  fireEvent(row!, 'layout', layout(0, tabs.length * tabWidth));
  tabs.forEach((tab, i) =>
    fireEvent(tab, 'layout', layout(i * tabWidth, tabWidth))
  );
};

describe('FastScrollSectionTab', () => {
  it('shows a tab for every section', () => {
    renderTabs();

    expect(screen.getByText('Fruits')).toBeOnTheScreen();
    expect(screen.getByText('Vegetables')).toBeOnTheScreen();
    expect(screen.getByText('Dairy')).toBeOnTheScreen();
  });

  it('scrolls the list to the header of the tapped section', async () => {
    const user = userEvent.setup();
    const { onScrollToIndex } = renderTabs();

    await user.press(screen.getByText('Dairy'));

    expect(onScrollToIndex).toHaveBeenCalledWith(12);
  });

  it('highlights the tab of the section that holds the first visible item', () => {
    const { showListItem } = renderTabs();
    expect(screen.getByText('Vegetables')).not.toHaveStyle(ACTIVE_TEXT_STYLE);

    showListItem(7);

    expect(screen.getByText('Vegetables')).toHaveStyle(ACTIVE_TEXT_STYLE);
    expect(screen.getByText('Fruits')).not.toHaveStyle(ACTIVE_TEXT_STYLE);
  });

  it('tells a custom tab label whether its section is active', () => {
    const { showListItem } = renderTabs([
      { index: 0, text: activeAwareLabel('Fruits') },
      { index: 5, text: activeAwareLabel('Vegetables') },
    ]);

    showListItem(2);

    expect(screen.getByText('Fruits (active)')).toBeOnTheScreen();
    expect(screen.getByText('Vegetables')).toBeOnTheScreen();
  });

  it('scrolls the tab bar to center the active tab, without scrolling past either end', () => {
    const { showListItem } = renderTabs([
      { index: 0, text: 'Fruits' },
      { index: 5, text: 'Vegetables' },
      { index: 10, text: 'Dairy' },
      { index: 15, text: 'Bakery' },
      { index: 20, text: 'Drinks' },
    ]);
    // 200px of a 500px row on screen: the bar scrolls between 0 and 300.
    layoutTabBar({ visibleWidth: 200, tabWidth: 100 });
    const scrollTo = getTabBarScrollTo();

    // Dairy spans 200..300; centered, the bar shows 150..350.
    showListItem(10);
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 150, animated: true });

    showListItem(20);
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 300, animated: true });

    showListItem(0);
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 0, animated: true });
  });

  it('scrolls the tab bar once each time the active section changes', () => {
    const { showListItem } = renderTabs();
    const scrollTo = getTabBarScrollTo();

    showListItem(6);
    showListItem(8);
    expect(scrollTo).toHaveBeenCalledTimes(1);

    showListItem(20);
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ animated: true })
    );
  });
});
