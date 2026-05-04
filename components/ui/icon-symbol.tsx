// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'calendar': 'calendar-today',
  'book.fill': 'menu-book',
  'square.grid.2x2': 'grid-view',
  'sparkles': 'auto-awesome',
  'ellipsis': 'more-horiz',
  'plus': 'add',
  'photo': 'photo',
  'map.fill': 'map',
  'list.bullet': 'list',
  'gearshape.fill': 'settings',
  'square.and.pencil': 'edit',
  'person.fill': 'person',
  'arrow.right': 'arrow-forward',
  'lock.fill': 'lock',
  'paintbrush.fill': 'palette',
  'bell.fill': 'notifications',
  'doc.fill': 'description',
  'wand.and.stars': 'auto-fix-high',
  'magnifyingglass': 'search',
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
