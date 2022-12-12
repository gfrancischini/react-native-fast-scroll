export interface Dimension {
  endecaDimensionId?: number;
  groupName: string;
  dimensionValues: DimensionValue[];
  isHidden: boolean;
}

export interface DimensionValue {
  name: string;
  id: number;
  displayOrder?: string;
  isMultiSelect: boolean;
  count: number;
  selected: string;
  lineBreakGroupID?: string;
  layoutID?: string;
  urluniqueId: string;
  categoryId?: number;
  minPrice?: string;
  maxPrice?: string;
}

export interface Product {
  additionalImageUrls: string[];
  crop: string;
  displayOrder: number;
  friendlyUrl: string;
  canonicalUrl: string;
  imageURL: string;
  isGroup: boolean;
  isNewProduct: boolean;
  isRelevance: boolean;
  isServiceable: boolean;
  mipsDescription: string;
  name: string;
  posDescription: string;
  price: string;
  sharpen: string;
  sharpenL: string;
  sku: string;
  title: string;
  titleSplit: string[];
  isPurchasable: boolean;
  showEmailWhenAvailable: boolean;
  formattedTitle: string;
  isLowInventory: boolean;
  isBOStatus: boolean;
  sortOrderEndeca: string;
  isMotifEnabled: boolean;
  groupMemberImageUrls: any[];
  groupMembers: GroupMember[];
  color: any[];
  setting: any[];
  diamondShape: any[];
  diamondCut: any[];
  diamondColor: any[];
  diamondClarity: any[];
  isAvailableOnline: boolean;
  department: string;
  class: string;
  style: string;
  parentGroups: any[];
  itemMasterNumber?: string;
  isIRExperience: boolean;
  formattedPrice: string;
  prodImageUrlSet: ProdImageUrlSet[];
  isShowCaseItem: boolean;
  extendedDescription?: string;
  defaultSku?: string;
  leafDefaultSku?: string;
  productTagID?: number;
  productTag?: string;
  type: string;
  metal: string;
}

export interface GroupMember {
  sku: string;
  displayOrder: number;
  mediaFileName: string;
  discontinuedWithInventory: string;
  lowInventory: string;
  purchasable: string;
  removeFromAssortment: string;
  irFlag: string;
  itemMaster: string;
}

export interface ProdImageUrlSet {
  mediaType: string;
  mediaTypeID: number;
  url: string;
}

export let products: Product[] = require('./multiCategoryData.json');

export type Header = {
  type: 'Header';
  id: string;
  index: number;
  category1: string;
  category2: string;

  //   dotActiveColor: string;
  //   dotInactiveColor: string;
  dotColor: string;
  showTextWhenInactive: boolean;
  textBackgroundColorActive: string;
};

export const data: (Product | Header)[] = [];

export type CategoryItemData = Product | Header;

import lodash from 'lodash';

products = lodash.sortBy(products, ['type', 'metal', 'name']);

let previousGroup: any = '';
let previousCategory1: string = '';
let groupIndex = 0;
let currentGroup: string = '';
products.forEach((product) => {
  currentGroup = `${product.type}-${product.metal}`;
  if (currentGroup !== previousGroup) {
    // found a new group
    previousGroup = currentGroup;

    const header: Header = {
      id: currentGroup,
      type: 'Header',
      index: groupIndex,
      category1: product.type,
      category2: product.metal,
      //   dotActiveColor: 'white',
      //   dotInactiveColor: '',
      dotColor: previousCategory1 !== product.type ? 'red' : 'white',
      textBackgroundColorActive: 'white',
      showTextWhenInactive: previousCategory1 !== product.type,
    };
    previousCategory1 = product.type;
    data.push(header);
    groupIndex++;
  }
  data.push(product);
});

// const buildList = <TRow>(objects: (TRow & Partial<PhantomRow>)[], groupSelector: GroupSelectorCallback<TRow>): (any | ListViewGroupRowItem)[] => {
//     const newList: (ListViewGroupRowItem | WithExtendedListProperties<TRow>)[] = [];
//     let previousGroup: any = "";
//     let groupIndex = 0;
//     let rowGroupIndex = 0;
//     let currentGroup: string = "";
//     objects.forEach((obj, index) => {
//         // do not parse not loaded views grouping
//         if (obj.type !== "NOT LOADED") {
//             // check for group selector
//             currentGroup = groupSelector(obj, previousGroup);
//             if (currentGroup !== previousGroup) {
//                 // found a new group
//                 previousGroup = currentGroup;
//                 rowGroupIndex = 0;
//                 const groupItem: ListViewGroupRowItem = {
//                     groupName: currentGroup,
//                     type: "GROUP",
//                     groupIndex
//                 };
//                 newList.push(groupItem);
//                 groupIndex++;
//             }
//         }
//         const listItem = obj as any as WithExtendedListProperties<TRow>;
//         listItem.extendedListProperties = { rowGroupIndex, rowGroupName: currentGroup };
//         newList.push(listItem);
//         rowGroupIndex++;
//     });
//     return newList;
// };

// const extendedDescriptionsCategory = new Set<string>();
// const typeCategory = new Set<string>();

// data.forEach(product => {
//     product.name = replaceAll(product.name, 'Return to Tiffany®', '');
//     product.name = replaceAll(product.name, 'Tiffany', '');
//     product.name = replaceAll(product.name, 'T1', '');
//     if(product.name.startsWith('T ')) {
//         product.name = product.name.replace('T ', '');
//     }
//     //product.name.replace("T", "");
//     product.name = product.name.trim();

//     product.metal = product.extendedDescription ?? "Other";
//     if(product.metal.startsWith("in ")) {
//         product.metal = product.metal.replace("in ", "");
//     }
//     product.metal.trim();
//     extendedDescriptionsCategory.add(product.metal);

//     const type = product.friendlyUrl.replace("/jewelry/", "").split("/")[0]?.replace("-jewelry", "").trim() ?? "Other";
//     product.type = type.length === 0 ? "Other" : type;
//     typeCategory.add(type);
// });

//https://www.tiffany.com/gifts/shop/gifts-for-her/
