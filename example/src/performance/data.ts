export type RowItem = {
  type: 'Row';
  id: number;
  title: string;
};

export type HeaderItem = {
  type: 'Header';
  category1: string;
  category2: string;
  showTextWhenInactive: boolean;
};

export type DataItem = RowItem | HeaderItem;

export const data: DataItem[] = [];

let currentCategory1 = 0;
let currentCategory2 = 0;
for (let i = 0; i < 500; i++) {
  if (i % 6 === 0 && i !== 0) {
    currentCategory2++;
    data.push({
      type: 'Header',
      category1: `Category ${currentCategory1}`,
      category2: `Category ${currentCategory2}`,
      showTextWhenInactive: false,
    });
  } else if (i % 20 === 0) {
    currentCategory1++;
    currentCategory2 = 0;
    data.push({
      type: 'Header',
      category1: `Category ${currentCategory1}`,
      category2: `Category ${currentCategory2}`,
      showTextWhenInactive: true,
    });
  } else {
    data.push({
      id: i,
      title: `Test ${i}`,
      type: 'Row',
    });
  }
}

// console.log('data', data)
