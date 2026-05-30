const REGIONS = [

  // ═══════════════════════════════════════════════════════════════
  // 🇰🇷🇯🇵  ASIA（4月）
  // ═══════════════════════════════════════════════════════════════
  {
    label:   '🇰🇷🇯🇵 ASIA (APR)',
    labelJP: '🇰🇷🇯🇵 アジア (4月)',
    cities: [
      {
        city: 'Goyang',
        reg: 'KR',
        country: 'KOREA',
        venue: 'Goyang Stadium',
        shows: ['4/9', '4/11', '4/12'],
        n: 3,
        fd: '2026-04-09',
        st: '2026-04-09T19:00:00+09:00',
        lat: 37.6583,
        lng: 126.8317,
        status: 'next'
      },
      {
        city: 'Tokyo',
        reg: 'JP',
        country: 'JAPAN',
        venue: '東京ドーム',
        shows: ['4/17', '4/18'],
        n: 2,
        fd: '2026-04-17',
        st: '2026-04-17T18:30:00+09:00',
        lat: 35.7056,
        lng: 139.7519,
        status: 'future'
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇺🇸  北米・メキシコ（4月〜5月）
  // ═══════════════════════════════════════════════════════════════
  {
    label:   '🇺🇸 N.AMERICA / MEXICO (APR–MAY)',
    labelJP: '🇺🇸 北米・メキシコ (4–5月)',
    cities: [
      {
        city: 'Tampa',
        reg: 'FL',
        country: 'USA',
        venue: 'Raymond James Stadium',
        shows: ['4/25', '4/26', '4/28'],
        n: 3,
        fd: '2026-04-25',
        st: '2026-04-25T20:00:00-04:00',
        lat: 27.9506,
        lng: -82.4572,
        status: 'future'
      },
      {
        city: 'El Paso',
        reg: 'TX',
        country: 'USA',
        venue: 'Sun Bowl Stadium',
        shows: ['5/2', '5/3'],
        n: 2,
        fd: '2026-05-02',
        st: '2026-05-02T20:00:00-06:00',
        lat: 31.7619,
        lng: -106.485,
        status: 'future'
      },
      {
        city: 'Mexico City',
        reg: 'MX',
        country: 'MEXICO',
        venue: 'Estadio GNP Seguros',
        shows: ['5/7', '5/9', '5/10'],
        n: 3,
        fd: '2026-05-07',
        st: '2026-05-07T20:00:00-06:00',
        lat: 19.4326,
        lng: -99.1332,
        status: 'future'
      },
      {
        city: 'Stanford',
        reg: 'CA',
        country: 'USA',
        venue: 'Stanford Stadium',
        shows: ['5/16', '5/17', '5/19'],
        n: 3,
        fd: '2026-05-16',
        st: '2026-05-16T19:00:00-07:00',
        lat: 37.4274,
        lng: -122.170,
        status: 'future'
      },
      {
        city: 'Las Vegas',
        reg: 'NV',
        country: 'USA',
        venue: 'Allegiant Stadium',
        shows: ['5/23', '5/24', '5/27', '5/28'],
        n: 4,
        fd: '2026-05-23',
        st: '2026-05-23T20:00:00-07:00',
        lat: 36.0905,
        lng: -115.183,
        status: 'future'
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇰🇷  韓国追加公演（6月）
  // ═══════════════════════════════════════════════════════════════
  {
    label:   '🇰🇷 KOREA 2nd (JUN)',
    labelJP: '🇰🇷 追加韓国公演 (6月)',
    cities: [
      {
        city: 'Busan',
        reg: 'KR',
        country: 'KOREA',
        venue: 'Busan Asiad Main Stadium',
        shows: ['6/12', '6/13'],
        n: 2,
        fd: '2026-06-12',
        st: '2026-06-12T19:00:00+09:00',
        lat: 35.1796,
        lng: 129.0756,
        status: 'future'
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇪🇺  ヨーロッパ（6月〜7月）
  // ═══════════════════════════════════════════════════════════════
  {
    label:   '🇪🇺 EUROPE (JUN–JUL)',
    labelJP: '🇪🇺 ヨーロッパ (6–7月)',
    cities: [
      {
        city: 'Madrid',
        reg: 'ES',
        country: 'SPAIN',
        venue: 'Riyadh Air Metropolitano',
        shows: ['6/26', '6/27'],
        n: 2,
        fd: '2026-06-26',
        st: '2026-06-26T20:00:00+02:00',
        lat: 40.4168,
        lng: -3.7038,
        status: 'future'
      },
      {
        city: 'Brussels',
        reg: 'BE',
        country: 'BELGIUM',
        venue: 'King Baudouin Stadium',
        shows: ['7/1', '7/2'],
        n: 2,
        fd: '2026-07-01',
        st: '2026-07-01T20:00:00+02:00',
        lat: 50.8503,
        lng: 4.3517,
        status: 'future'
      },
      {
        city: 'London',
        reg: 'UK',
        country: 'UK',
        venue: 'Tottenham Hotspur Stadium',
        shows: ['7/6', '7/7'],
        n: 2,
        fd: '2026-07-06',
        st: '2026-07-06T19:00:00+01:00',
        lat: 51.6040,
        lng: -0.0670,
        status: 'future'
      },
      {
        city: 'Munich',
        reg: 'DE',
        country: 'GERMANY',
        venue: 'Allianz Arena',
        shows: ['7/11', '7/12'],
        n: 2,
        fd: '2026-07-11',
        st: '2026-07-11T20:00:00+02:00',
        lat: 48.2188,
        lng: 11.6247,
        status: 'future'
      },
      {
        city: 'Paris',
        reg: 'FR',
        country: 'FRANCE',
        venue: 'Stade de France',
        shows: ['7/17', '7/18'],
        n: 2,
        fd: '2026-07-17',
        st: '2026-07-17T20:00:00+02:00',
        lat: 48.9244,
        lng: 2.3601,
        status: 'future'
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 🇺🇸🇨🇦  北米 2nd（8月〜9月）
  // ═══════════════════════════════════════════════════════════════
  {
    label:   '🇺🇸🇨🇦 N.AMERICA 2 (AUG–SEP)',
    labelJP: '🇺🇸🇨🇦 北米 2nd (8–9月)',
    cities: [
      {
        city: 'East Rutherford',
        reg: 'NJ',
        country: 'USA',
        venue: 'MetLife Stadium',
        shows: ['8/1', '8/2'],
        n: 2,
        fd: '2026-08-01',
        st: '2026-08-01T20:00:00-04:00',
        lat: 40.8128,
        lng: -74.0742,
        status: 'future'
      },
      {
        city: 'Foxborough',
        reg: 'MA',
        country: 'USA',
        venue: 'Gillette Stadium',
        shows: ['8/5', '8/6'],
        n: 2,
        fd: '2026-08-05',
        st: '2026-08-05T20:00:00-04:00',
        lat: 42.0909,
        lng: -71.2643,
        status: 'future'
      },
      {
        city: 'Baltimore',
        reg: 'MD',
        country: 'USA',
        venue: 'M&T Bank Stadium',
        shows: ['8/10', '8/11'],
        n: 2,
        fd: '2026-08-10',
        st: '2026-08-10T20:00:00-04:00',
        lat: 39.2780,
        lng: -76.6228,
        status: 'future'
      },
      {
        city: 'Arlington',
        reg: 'TX',
        country: 'USA',
        venue: 'AT&T Stadium',
        shows: ['8/15', '8/16'],
        n: 2,
        fd: '2026-08-15',
        st: '2026-08-15T20:00:00-05:00',
        lat: 32.7480,
        lng: -97.0929,
        status: 'future'
      },
      {
        city: 'Toronto',
        reg: 'ON',
        country: 'CANADA',
        venue: 'Rogers Stadium',
        shows: ['8/22', '8/23'],
        n: 2,
        fd: '2026-08-22',
        st: '2026-08-22T20:00:00-04:00',
        lat: 43.6532,
        lng: -79.3832,
        status: 'future'
      },
      {
        city: 'Chicago',
        reg: 'IL',
        country: 'USA',
        venue: 'Soldier Field',
        shows: ['8/27', '8/28'],
        n: 2,
        fd: '2026-08-27',
        st: '2026-08-27T20:00:00-05:00',
        lat: 41.8625,
        lng: -87.6167,
        status: 'future'
      },
      {
        city: 'Los Angeles',
        reg: 'CA',
        country: 'USA',
        venue: 'SoFi Stadium',
        shows: ['9/1', '9/2', '9/5', '9/6'],
        n: 4,
        fd: '2026-09-01',
        st: '2026-09-01T20:00:00-07:00',
        lat: 33.9535,
        lng: -118.339,
        status: 'future'
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 🌎  ラテンアメリカ（10月）
  // ═══════════════════════════════════════════════════════════════
  {
    label:   '🌎 LATIN AMERICA (OCT)',
    labelJP: '🌎 ラテンアメリカ (10月)',
    cities: [
      {
        city: 'Bogotá',
        reg: 'CO',
        country: 'COLOMBIA',
        venue: 'Estadio El Campín',
        shows: ['10/2', '10/3'],
        n: 2,
        fd: '2026-10-02',
        st: '2026-10-02T20:00:00-05:00',
        lat: 4.6297,
        lng: -74.0817,
        status: 'future'
      },
      {
        city: 'Lima',
        reg: 'PE',
        country: 'PERU',
        venue: 'Estadio San Marcos',
        shows: ['10/7', '10/9', '10/10'],
        n: 3,
        fd: '2026-10-07',
        st: '2026-10-07T20:00:00-05:00',
        lat: -12.057,
        lng: -77.0842,
        status: 'future'
      },
      {
        city: 'Santiago',
        reg: 'CL',
        country: 'CHILE',
        venue: 'Estadio Nacional',
        shows: ['10/14', '10/16', '10/17'],
        n: 3,
        fd: '2026-10-14',
        st: '2026-10-14T20:00:00-03:00',
        lat: -33.464,
        lng: -70.6113,
        status: 'future'
      },
      {
        city: 'Buenos Aires',
        reg: 'AR',
        country: 'ARGENTINA',
        venue: 'Estadio Único de La Plata',
        shows: ['10/21', '10/23', '10/24'],
        n: 3,
        fd: '2026-10-21',
        st: '2026-10-21T20:00:00-03:00',
        lat: -34.903,
        lng: -57.9994,
        status: 'future'
      },
      {
        city: 'São Paulo',
        reg: 'BR',
        country: 'BRAZIL',
        venue: 'Estádio do MorumBIS',
        shows: ['10/28', '10/30', '10/31'],
        n: 3,
        fd: '2026-10-28',
        st: '2026-10-28T20:00:00-03:00',
        lat: -23.545,
        lng: -46.4738,
        status: 'future'
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 🌏  アジア・オセアニア（11月〜2027年3月）
  // ═══════════════════════════════════════════════════════════════
  {
    label:   '🌏 ASIA / OCEANIA (NOV–MAR 2027)',
    labelJP: '🌏 アジア・オセアニア (11月〜2027年3月)',
    cities: [
      {
        city: 'Kaohsiung',
        reg: 'TW',
        country: 'TAIWAN',
        venue: 'Kaohsiung National Stadium',
        shows: ['11/19', '11/21', '11/22'],
        n: 3,
        fd: '2026-11-19',
        st: '2026-11-19T19:00:00+08:00',
        lat: 22.6273,
        lng: 120.3014,
        status: 'future'
      },
      {
        city: 'Bangkok',
        reg: 'TH',
        country: 'THAILAND',
        venue: 'Rajamangala National Stadium',
        shows: ['12/3', '12/5', '12/6'],
        n: 3,
        fd: '2026-12-03',
        st: '2026-12-03T19:00:00+07:00',
        lat: 13.7563,
        lng: 100.5018,
        status: 'future'
      },
      {
        city: 'Kuala Lumpur',
        reg: 'MY',
        country: 'MALAYSIA',
        venue: 'TM Stadium Nasional',
        shows: ['12/12', '12/13'],
        n: 2,
        fd: '2026-12-12',
        st: '2026-12-12T20:00:00+08:00',
        lat: 3.1390,
        lng: 101.6869,
        status: 'future'
      },
      {
        city: 'Singapore',
        reg: 'SG',
        country: 'SINGAPORE',
        venue: 'National Stadium',
        shows: ['12/17', '12/19', '12/20', '12/22'],
        n: 4,
        fd: '2026-12-17',
        st: '2026-12-17T19:00:00+08:00',
        lat: 1.3521,
        lng: 103.8198,
        status: 'future'
      },
      {
        city: 'Jakarta',
        reg: 'ID',
        country: 'INDONESIA',
        venue: 'TBA',
        shows: ['12/26', '12/27'],
        n: 2,
        fd: '2026-12-26',
        st: '2026-12-26T19:00:00+07:00',
        lat: -6.2088,
        lng: 106.8456,
        status: 'future'
      },
      {
        city: 'Melbourne',
        reg: 'AU',
        country: 'AUSTRALIA',
        venue: 'TBA',
        shows: ['2/12', '2/13'],
        n: 2,
        fd: '2027-02-12',
        st: '2027-02-12T19:00:00+11:00',
        lat: -37.813,
        lng: 144.9631,
        status: 'future'
      },
      {
        city: 'Sydney',
        reg: 'AU',
        country: 'AUSTRALIA',
        venue: 'TBA',
        shows: ['2/20', '2/21'],
        n: 2,
        fd: '2027-02-20',
        st: '2027-02-20T19:00:00+11:00',
        lat: -33.868,
        lng: 151.2093,
        status: 'future'
      },
      {
        city: 'Hong Kong',
        reg: 'HK',
        country: 'HONG KONG',
        venue: 'Kai Tak Stadium',
        shows: ['3/4', '3/6', '3/7'],
        n: 3,
        fd: '2027-03-04',
        st: '2027-03-04T19:00:00+08:00',
        lat: 22.3193,
        lng: 114.1694,
        status: 'future'
      },
      {
        city: 'Manila',
        reg: 'PH',
        country: 'PHILIPPINES',
        venue: 'Philippine Sports Stadium',
        shows: ['3/13', '3/14'],
        n: 2,
        fd: '2027-03-13',
        st: '2027-03-13T19:00:00+08:00',
        lat: 14.4793,
        lng: 121.0020,
        status: 'future'
      }
    ]
  }
]; // ← REGIONS 終わり